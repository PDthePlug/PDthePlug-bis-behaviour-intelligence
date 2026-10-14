import { z } from "zod";
import { withSupabaseRequest } from "@/db";
import { getRoles, identityFrom } from "@/lib/bis-access";
import { runProgrammeInsightAgent } from "@/lib/evidence-intelligence/agents";
import { resolveAuthoredCompetency } from "@/lib/evidence-intelligence/competencies";
import { ProgrammeAggregateSchema } from "@/lib/evidence-intelligence/contracts";
import { evidenceAgentGatewayConfigured } from "@/lib/evidence-intelligence/gateway";
import { requestSupabaseClient } from "@/lib/supabase/server";

const headers = { "cache-control": "private, no-store" };
const id = z.string().min(1).max(200);
const requestSchema = z.object({ cohortId: id }).strict();
const allowedRoles = new Set(["FACILITATOR", "PROGRAMME_OWNER", "SPONSOR_VIEWER", "SYSTEM_ADMIN"]);

async function post(request: Request) {
  const identity = await identityFrom();
  if (!identity) {
    return Response.json({ error: "Sign in is required." }, { status: 401, headers });
  }
  const roles = await getRoles(identity);
  if (!roles.some((role) => allowedRoles.has(role))) {
    return Response.json({ error: "Programme evidence access is required." }, { status: 403, headers });
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Choose a valid cohort." }, { status: 400, headers });
  }

  if (!evidenceAgentGatewayConfigured()) {
    return Response.json(
      { error: "Evidence intelligence is not enabled in this environment." },
      { status: 503, headers },
    );
  }

  try {
    const { data, error } = await requestSupabaseClient().rpc("bis_agent_programme_aggregate", {
      p_cohort: input.cohortId,
    });
    if (error) {
      return Response.json(
        { error: "Programme evidence is not available for this cohort." },
        { status: 403, headers },
      );
    }

    const parsed = ProgrammeAggregateSchema.parse(data);
    const enriched = ProgrammeAggregateSchema.parse({
      ...parsed,
      competencies: parsed.competencies.map((item) => {
        const competency = resolveAuthoredCompetency(item.competencyId);
        if (!competency) {
          throw new Error("Programme aggregate references a competency outside the authored BIS framework.");
        }
        return { ...item, label: competency.title };
      }),
    });

    if (enriched.participantCount < 5 || enriched.competencies.length === 0) {
      return Response.json(
        {
          schemaVersion: "bis-evidence-programme-insight:1",
          aggregate: enriched,
          insight: null,
          agentMetadata: null,
          reportable: false,
          basis:
            "No programme narrative was generated because privacy thresholds or reviewed-evidence coverage do not support a safe competency-level aggregate.",
        },
        { headers },
      );
    }

    const insight = await runProgrammeInsightAgent(enriched);
    return Response.json(
      {
        schemaVersion: "bis-evidence-programme-insight:1",
        aggregate: enriched,
        insight: insight?.output ?? null,
        agentMetadata: insight
          ? { model: insight.model, promptVersion: insight.promptVersion }
          : null,
        reportable: false,
        basis:
          "Programme Insight receives only suppression-safe, reviewed-evidence aggregates. It receives no learner identity, evidence ID, response wording, assessment feedback or P3 content, and it may not establish mastery, transfer or programme causation.",
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Programme evidence intelligence could not complete this review." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => post(request));
}
