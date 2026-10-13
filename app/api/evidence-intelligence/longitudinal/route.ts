import { z } from "zod";
import { withSupabaseRequest } from "@/db";
import { getRoles, hasRole, identityFrom } from "@/lib/bis-access";
import { resolveAuthoredCompetency } from "@/lib/evidence-intelligence/competencies";
import { LongitudinalEvidenceItemSchema } from "@/lib/evidence-intelligence/contracts";
import { runLongitudinalSynthesisAgent } from "@/lib/evidence-intelligence/agents";
import { evidenceAgentGatewayConfigured } from "@/lib/evidence-intelligence/gateway";
import { requestSupabaseClient } from "@/lib/supabase/server";

const headers = { "cache-control": "private, no-store" };
const id = z.string().min(1).max(200);
const requestSchema = z
  .object({
    cohortId: id,
    learnerUserId: id,
    competencyId: z.string().min(1).max(120),
  })
  .strict();
const historySchema = z.array(LongitudinalEvidenceItemSchema).max(200);

async function post(request: Request) {
  const identity = await identityFrom();
  if (!identity) {
    return Response.json({ error: "Sign in is required." }, { status: 401, headers });
  }
  const roles = await getRoles(identity);
  if (!hasRole(roles, "FACILITATOR")) {
    return Response.json({ error: "Facilitator review access is required." }, { status: 403, headers });
  }

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Choose a valid learner, cohort and competency." }, { status: 400, headers });
  }

  const competency = resolveAuthoredCompetency(input.competencyId);
  if (!competency) {
    return Response.json({ error: "Choose a recognised BIS competency." }, { status: 409, headers });
  }
  if (!evidenceAgentGatewayConfigured()) {
    return Response.json(
      { error: "Evidence intelligence is not enabled in this environment." },
      { status: 503, headers },
    );
  }

  try {
    const { data, error } = await requestSupabaseClient().rpc("bis_agent_reviewed_evidence_history", {
      p_cohort: input.cohortId,
      p_learner: input.learnerUserId,
      p_competency: competency.id,
    });
    if (error) {
      return Response.json(
        { error: "Reviewed evidence history is not available for this learner." },
        { status: 403, headers },
      );
    }

    const history = historySchema.parse(data ?? []);
    const synthesis = await runLongitudinalSynthesisAgent({
      competencyId: competency.id,
      competencyTitle: competency.title,
      evidence: history,
    });

    return Response.json(
      {
        schemaVersion: "bis-evidence-longitudinal:1",
        competency: { id: competency.id, title: competency.title },
        reviewedEvidenceCount: history.length,
        synthesis: synthesis?.output ?? null,
        agentMetadata: synthesis
          ? { model: synthesis.model, promptVersion: synthesis.promptVersion }
          : null,
        reportable: false,
        basis:
          "Longitudinal synthesis uses only current, consented, learner-shared evidence whose latest human assessment is REVIEWED. Current source contracts conservatively support NOTICE and rubric-linked LEARNING_CHECK evidence up to EXPLAIN; this output is not mastery, diagnosis, transfer certification or causal programme evidence.",
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Longitudinal evidence intelligence could not complete this review." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => post(request));
}
