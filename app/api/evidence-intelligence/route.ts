import { z } from "zod";
import { withSupabaseRequest } from "@/db";
import { getRoles, hasRole, identityFrom } from "@/lib/bis-access";
import { requestSupabaseClient } from "@/lib/supabase/server";
import { EvidenceContextSchema } from "@/lib/evidence-intelligence/contracts";
import { resolveAuthoredCompetency } from "@/lib/evidence-intelligence/competencies";
import { evidenceAgentGatewayConfigured } from "@/lib/evidence-intelligence/gateway";
import { analyseEvidence } from "@/lib/evidence-intelligence/orchestrator";

const headers = { "cache-control": "private, no-store" };
const id = z.string().min(1).max(200);
const requestSchema = z.object({ evidenceId: id }).strict();
const rpcContextSchema = z
  .object({
    evidenceId: id,
    labCode: z.string().min(1).max(100),
    labVersion: z.string().min(1).max(100),
    semanticFieldId: id,
    questionLabel: z.string().min(1).max(1200),
    portfolioPurpose: z.string().max(1600),
    authoredOutcome: z.string().max(1600),
    evidenceClass: z.enum([
      "BASELINE",
      "CONTEXT",
      "PREDICTION",
      "PLAN",
      "OBSERVATION",
      "OUTCOME",
      "INTERPRETATION",
      "TRANSFER",
      "LEARNING_CHECK",
      "SUPPORT_SIGNAL",
      "UNCLASSIFIED",
    ]),
    sensitivity: z.enum(["P0", "P1", "P2"]),
    sourceNature: z.literal("SELF_REPORT"),
    mappingStatus: z.literal("APPROVED"),
    competencyId: z.string().min(1).max(1000),
    stageCeiling: z.enum([
      "NOT_YET_EVIDENCED",
      "NOTICE",
      "EXPLAIN",
      "APPLY",
      "TEST_AND_REVISE",
      "TRANSFER",
    ]),
    occurredAt: z.string().min(1),
    learnerText: z.string().min(1).max(100_000),
    rubric: z
      .object({
        id,
        title: z.string().min(1).max(300),
        criteria: z.array(z.unknown()).max(20),
        scaleMin: z.number().int(),
        scaleMax: z.number().int(),
      })
      .nullable(),
  })
  .strict();

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
    return Response.json({ error: "Choose valid evidence to analyse." }, { status: 400, headers });
  }

  if (!evidenceAgentGatewayConfigured()) {
    return Response.json(
      { error: "Evidence intelligence is not enabled in this environment." },
      { status: 503, headers },
    );
  }

  try {
    // The client may supply only an evidence ID. The database resolves raw text and
    // curriculum context under the facilitator's current learner-submission boundary.
    const { data, error } = await requestSupabaseClient().rpc("bis_evidence_agent_context", {
      p_evidence_id: input.evidenceId,
    });
    if (error) {
      return Response.json(
        { error: "This evidence is not available for model-assisted review." },
        { status: 403, headers },
      );
    }

    const source = rpcContextSchema.parse(data);
    const competency = resolveAuthoredCompetency(source.competencyId);
    if (!competency) {
      return Response.json(
        { error: "This evidence does not yet have a recognised BIS competency mapping." },
        { status: 409, headers },
      );
    }

    const context = EvidenceContextSchema.parse({
      evidenceId: source.evidenceId,
      labCode: source.labCode,
      labVersion: source.labVersion,
      semanticFieldId: source.semanticFieldId,
      questionLabel: source.questionLabel,
      portfolioPurpose: source.portfolioPurpose,
      authoredOutcome: source.authoredOutcome,
      evidenceClass: source.evidenceClass,
      sensitivity: source.sensitivity,
      sourceNature: source.sourceNature,
      mappingStatus: source.mappingStatus,
      stageCeiling: source.stageCeiling,
      occurredAt: source.occurredAt,
      learnerText: source.learnerText.slice(0, 6000),
      allowedCompetencies: [competency],
      rubric: source.rubric,
    });

    const analysis = await analyseEvidence({ context, priorEvidence: [] });

    return Response.json(
      {
        schemaVersion: "bis-evidence-intelligence:1",
        evidenceId: source.evidenceId,
        competency: { id: competency.id, title: competency.title },
        disposition: analysis.disposition,
        interpretation: analysis.interpretation?.output ?? null,
        classification: analysis.classification?.output ?? null,
        quality: analysis.quality?.output ?? null,
        agentMetadata: {
          interpretation: analysis.interpretation
            ? {
                model: analysis.interpretation.model,
                promptVersion: analysis.interpretation.promptVersion,
              }
            : null,
          classification: analysis.classification
            ? {
                model: analysis.classification.model,
                promptVersion: analysis.classification.promptVersion,
              }
            : null,
          quality: analysis.quality
            ? { model: analysis.quality.model, promptVersion: analysis.quality.promptVersion }
            : null,
        },
        reportable: false,
        basis:
          "This is a model-assisted evidence proposal for facilitator review, not a human assessment, diagnosis, capability certification or programme outcome. Original evidence remains authoritative; reportable assessment continues through the existing reviewed evidence workflow.",
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Evidence intelligence could not complete this review." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: Request) {
  return withSupabaseRequest(() => post(request));
}
