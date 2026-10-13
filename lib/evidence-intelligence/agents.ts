import {
  EvidenceClassificationSchema,
  EvidenceContextSchema,
  LongitudinalEvidenceItemSchema,
  LongitudinalSynthesisSchema,
  ProgrammeAggregateSchema,
  ProgrammeInsightSchema,
  QualityContradictionSchema,
  ResponseInterpretationSchema,
  type AgentEnvelope,
  type EvidenceClassification,
  type EvidenceContext,
  type EvidenceStage,
  type LongitudinalSynthesis,
  type ProgrammeAggregate,
  type ProgrammeInsight,
  type QualityContradiction,
  type ResponseInterpretation,
} from "./contracts";
import { callEvidenceAgent } from "./gateway";
import {
  clampEvidenceStage,
  evidenceAiMinConfidence,
  humanReviewRequired,
  minimiseLearnerText,
  normaliseConfidence,
  programmeInsightInputIsAggregateOnly,
  sensitivityMayReachModel,
} from "./core.mjs";

const PROMPTS = {
  interpretation: "bis-evidence-interpretation-v1",
  classification: "bis-evidence-classification-v1",
  longitudinal: "bis-longitudinal-synthesis-v1",
  quality: "bis-quality-contradiction-v1",
  programme: "bis-programme-insight-v1",
} as const;

function requireApprovedContext(input: EvidenceContext) {
  if (!sensitivityMayReachModel(input.sensitivity)) {
    throw new Error("This evidence sensitivity may not be sent to the evidence model.");
  }
  if (input.mappingStatus !== "APPROVED") {
    throw new Error("Model-assisted interpretation requires an approved curriculum mapping.");
  }
  if (input.allowedCompetencies.length === 0) {
    throw new Error("Model-assisted interpretation requires authored competency scope.");
  }
}

function preparedContext(input: EvidenceContext) {
  const parsed = EvidenceContextSchema.parse(input);
  requireApprovedContext(parsed);
  return {
    ...parsed,
    learnerText: minimiseLearnerText(parsed.learnerText, 6000),
  };
}

function confidence(value: number) {
  return normaliseConfidence(value);
}

export async function runResponseInterpretationAgent(
  rawContext: EvidenceContext,
): Promise<AgentEnvelope<ResponseInterpretation> | null> {
  const context = preparedContext(rawContext);
  const result = await callEvidenceAgent({
    agent: "RESPONSE_INTERPRETATION",
    promptVersion: PROMPTS.interpretation,
    schema: ResponseInterpretationSchema,
    instructions: `Understand what the learner is communicating in relation to the authored question and its evidence purpose.
Separate explicit evidence from implication. Do not assign a competency stage or score; that belongs to another agent.
Do not quote the learner. Behavioural signals must describe only what is evidenced in this response.
If the response is vague, hypothetical, copied, contradictory or not responsive to the question, record that under uncertainties and lower confidence.
sourceNature is supplied by BIS and is immutable. Return that exact value; never upgrade SELF_REPORT to OBSERVED, ASSESSED or MIXED.`,
    input: {
      labCode: context.labCode,
      labVersion: context.labVersion,
      semanticFieldId: context.semanticFieldId,
      question: context.questionLabel,
      portfolioPurpose: context.portfolioPurpose,
      authoredOutcome: context.authoredOutcome,
      evidenceClass: context.evidenceClass,
      sourceNature: context.sourceNature,
      allowedCompetencies: context.allowedCompetencies,
      learnerResponse: context.learnerText,
    },
  });
  if (!result) return null;

  const output = ResponseInterpretationSchema.parse({
    ...result.output,
    sourceNature: context.sourceNature,
    confidence: confidence(result.output.confidence),
  });
  return {
    agent: "RESPONSE_INTERPRETATION",
    promptVersion: PROMPTS.interpretation,
    model: result.model,
    output,
  };
}

export async function runEvidenceClassificationAgent(args: {
  context: EvidenceContext;
  interpretation: ResponseInterpretation;
}): Promise<AgentEnvelope<EvidenceClassification> | null> {
  const context = preparedContext(args.context);
  const interpretation = ResponseInterpretationSchema.parse(args.interpretation);
  const allowedCompetencyIds = new Set(context.allowedCompetencies.map((item) => item.id));

  const result = await callEvidenceAgent({
    agent: "EVIDENCE_CLASSIFICATION",
    promptVersion: PROMPTS.classification,
    schema: EvidenceClassificationSchema,
    instructions: `Map the already-interpreted evidence to the authored competency scope.
Use only competency IDs supplied in allowedCompetencies. Do not invent a competency.
The evidenceClass must remain the supplied authored evidenceClass.
proposedStage describes the strongest stage supported by this response but may never exceed stageCeiling.
A plan, prediction, reflection or self-report is not proof that a behaviour occurred unless the source context supports that claim.
Use NOT_SUPPORTED when the response does not provide enough evidence.`,
    input: {
      authoredEvidenceClass: context.evidenceClass,
      sourceNature: context.sourceNature,
      stageCeiling: context.stageCeiling,
      allowedCompetencies: context.allowedCompetencies,
      rubric: context.rubric,
      interpretation,
    },
  });
  if (!result) return null;

  const invalidCompetency = result.output.competencyIds.some((id) => !allowedCompetencyIds.has(id));
  if (invalidCompetency) {
    throw new Error("Evidence classification attempted to use a competency outside authored scope.");
  }
  if (result.output.evidenceClass !== context.evidenceClass) {
    throw new Error("Evidence classification attempted to change the authored evidence class.");
  }

  const proposedStage = clampEvidenceStage(result.output.proposedStage, context.stageCeiling);
  const lowTrust = humanReviewRequired({
    confidence: result.output.confidence,
    uncertainty: interpretation.uncertainties.length > 0,
    sensitivity: context.sensitivity,
  });
  const evidenceStrength =
    context.sourceNature === "SELF_REPORT" && result.output.evidenceStrength === "STRONG"
      ? "MODERATE"
      : result.output.evidenceStrength;
  const claimStatus =
    result.output.claimStatus === "NOT_SUPPORTED"
      ? "NOT_SUPPORTED"
      : lowTrust
        ? "REVIEW_REQUIRED"
        : "PROPOSED";

  const output = EvidenceClassificationSchema.parse({
    ...result.output,
    proposedStage,
    evidenceStrength,
    claimStatus,
    confidence: confidence(result.output.confidence),
  });
  return {
    agent: "EVIDENCE_CLASSIFICATION",
    promptVersion: PROMPTS.classification,
    model: result.model,
    output,
  };
}

export async function runLongitudinalSynthesisAgent(args: {
  competencyId: string;
  competencyTitle: string;
  evidence: unknown[];
}): Promise<AgentEnvelope<LongitudinalSynthesis> | null> {
  const evidence = args.evidence.map((item) => LongitudinalEvidenceItemSchema.parse(item));
  const scoped = evidence
    .filter((item) => item.competencyIds.includes(args.competencyId))
    .filter((item) => item.reviewStatus !== "REJECTED")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  if (scoped.length === 0) {
    return {
      agent: "LONGITUDINAL_SYNTHESIS",
      promptVersion: PROMPTS.longitudinal,
      model: "deterministic",
      output: LongitudinalSynthesisSchema.parse({
        competencyId: args.competencyId,
        pattern: "INSUFFICIENT_EVIDENCE",
        highestSupportedStage: "NOT_YET_EVIDENCED",
        evidenceCount: 0,
        synthesis: "No eligible evidence has been recorded for longitudinal interpretation.",
        supportingEvidenceIds: [],
        contradictoryEvidenceIds: [],
        confidence: 1,
        requiresHumanReview: false,
      }),
    };
  }

  const orderedStages: EvidenceStage[] = [
    "NOT_YET_EVIDENCED",
    "NOTICE",
    "EXPLAIN",
    "APPLY",
    "TEST_AND_REVISE",
    "TRANSFER",
  ];
  const maximumSourceStage = scoped.reduce<EvidenceStage>((highest, item) => {
    return orderedStages.indexOf(item.stage) > orderedStages.indexOf(highest) ? item.stage : highest;
  }, "NOT_YET_EVIDENCED");

  const result = await callEvidenceAgent({
    agent: "LONGITUDINAL_SYNTHESIS",
    promptVersion: PROMPTS.longitudinal,
    schema: LongitudinalSynthesisSchema,
    instructions: `Synthesize change over time for one authored competency using only derived evidence records.
Do not infer a development trend from chronology alone. Consider evidence strength, source nature, review status and contradictions.
The highestSupportedStage may never exceed the strongest stage already present in the source records.
TRANSFER_CANDIDATE is allowed only when at least one eligible source record is already classified as TRANSFER; never infer transfer merely from repetition.
Do not claim causation, mastery or durable change.`,
    input: {
      competencyId: args.competencyId,
      competencyTitle: args.competencyTitle,
      evidence: scoped,
      maximumSourceStage,
    },
    maxOutputTokens: 1800,
  });
  if (!result) return null;

  const sourceIds = new Set(scoped.map((item) => item.evidenceId));
  const referencesUnknownEvidence = [
    ...result.output.supportingEvidenceIds,
    ...result.output.contradictoryEvidenceIds,
  ].some((id) => !sourceIds.has(id));
  if (referencesUnknownEvidence) {
    throw new Error("Longitudinal synthesis referenced evidence outside the supplied history.");
  }

  let highestSupportedStage = clampEvidenceStage(result.output.highestSupportedStage, maximumSourceStage);
  const hasTransferSource = scoped.some((item) => item.stage === "TRANSFER");
  const pattern =
    result.output.pattern === "TRANSFER_CANDIDATE" && !hasTransferSource
      ? "INCONSISTENT"
      : result.output.pattern;
  if (!hasTransferSource && highestSupportedStage === "TRANSFER") {
    highestSupportedStage = maximumSourceStage;
  }

  const output = LongitudinalSynthesisSchema.parse({
    ...result.output,
    competencyId: args.competencyId,
    pattern,
    highestSupportedStage,
    evidenceCount: scoped.length,
    confidence: confidence(result.output.confidence),
    requiresHumanReview:
      result.output.requiresHumanReview ||
      humanReviewRequired({ confidence: result.output.confidence, contradiction: result.output.contradictoryEvidenceIds.length > 0 }),
  });
  return {
    agent: "LONGITUDINAL_SYNTHESIS",
    promptVersion: PROMPTS.longitudinal,
    model: result.model,
    output,
  };
}

export async function runQualityContradictionAgent(args: {
  context: EvidenceContext;
  interpretation: ResponseInterpretation;
  classification: EvidenceClassification;
  priorEvidence: unknown[];
}): Promise<AgentEnvelope<QualityContradiction> | null> {
  const context = preparedContext(args.context);
  const interpretation = ResponseInterpretationSchema.parse(args.interpretation);
  const classification = EvidenceClassificationSchema.parse(args.classification);
  const priorEvidence = args.priorEvidence.map((item) => LongitudinalEvidenceItemSchema.parse(item));
  const allowed = new Set(context.allowedCompetencies.map((item) => item.id));
  const competencyWithinAuthoredScope = classification.competencyIds.every((id) => allowed.has(id));
  const stageWithinSourceLimits =
    clampEvidenceStage(classification.proposedStage, context.stageCeiling) === classification.proposedStage;

  const result = await callEvidenceAgent({
    agent: "QUALITY_CONTRADICTION",
    promptVersion: PROMPTS.quality,
    schema: QualityContradictionSchema,
    instructions: `Act as a conservative second-pass quality check.
Test whether the proposed classification is actually supported by the interpretation and whether prior derived evidence creates a meaningful contradiction.
Do not reward agreement between agents. Look actively for overclaiming, source-provenance mismatch, hypothetical language, insufficient context, contradictory chronology and claims beyond the authored competency or stage ceiling.
A contradiction is a reason for review, not proof that the learner is unreliable.`,
    input: {
      authoredScope: {
        evidenceClass: context.evidenceClass,
        sourceNature: context.sourceNature,
        stageCeiling: context.stageCeiling,
        allowedCompetencies: context.allowedCompetencies,
      },
      interpretation,
      classification,
      priorEvidence,
    },
  });
  if (!result) return null;

  const hasContradiction = result.output.verdict === "CONTRADICTED" || result.output.contradictions.length > 0;
  const requiresHumanReview =
    result.output.requiresHumanReview ||
    !competencyWithinAuthoredScope ||
    !stageWithinSourceLimits ||
    humanReviewRequired({
      confidence: result.output.adjustedConfidence,
      contradiction: hasContradiction,
      sensitivity: context.sensitivity,
    });

  const output = QualityContradictionSchema.parse({
    ...result.output,
    stageWithinSourceLimits,
    competencyWithinAuthoredScope,
    adjustedConfidence: confidence(
      Math.min(result.output.adjustedConfidence, classification.confidence, interpretation.confidence),
    ),
    requiresHumanReview,
  });
  return {
    agent: "QUALITY_CONTRADICTION",
    promptVersion: PROMPTS.quality,
    model: result.model,
    output,
  };
}

function containsProhibitedOutcomeLanguage(text: string) {
  return /\b(caused|causes|proves?|mastered|certified|programme effect|because of BIS|due to BIS)\b/i.test(text);
}

export async function runProgrammeInsightAgent(
  rawAggregate: ProgrammeAggregate,
): Promise<AgentEnvelope<ProgrammeInsight> | null> {
  const aggregate = ProgrammeAggregateSchema.parse(rawAggregate);
  if (!programmeInsightInputIsAggregateOnly(aggregate)) {
    throw new Error("Programme Insight Agent accepts aggregate-only input.");
  }
  if (aggregate.participantCount < 5) {
    throw new Error("Programme Insight Agent may not analyse a cohort below the reporting threshold.");
  }

  const result = await callEvidenceAgent({
    agent: "PROGRAMME_INSIGHT",
    promptVersion: PROMPTS.programme,
    schema: ProgrammeInsightSchema,
    instructions: `Translate already-governed aggregate evidence into concise programme intelligence.
Never request or infer individual learner responses. Do not reconstruct suppressed cells.
Distinguish participation, self-report, assessed evidence, behaviour and transfer. Do not turn correlation or before/later comparison into causation.
Do not claim a competency was acquired or mastered unless the aggregate explicitly says an authored assessment established that claim, and even then use the supplied wording.
Every important limitation in the aggregate must remain visible in limitations.`,
    input: aggregate,
    maxOutputTokens: 1800,
  });
  if (!result) return null;

  const allNarrative = [
    result.output.headline,
    ...result.output.findings,
    ...result.output.supportPriorities,
  ].join(" ");
  if (containsProhibitedOutcomeLanguage(allNarrative)) {
    throw new Error("Programme Insight Agent produced a prohibited causal or mastery claim.");
  }

  const output = ProgrammeInsightSchema.parse({
    ...result.output,
    limitations: Array.from(new Set([...aggregate.limitations, ...result.output.limitations])).slice(0, 8),
    confidence: confidence(result.output.confidence),
  });
  return {
    agent: "PROGRAMME_INSIGHT",
    promptVersion: PROMPTS.programme,
    model: result.model,
    output,
  };
}

export const evidenceAgentPromptVersions = PROMPTS;
export const evidenceAgentMinimumConfidence = evidenceAiMinConfidence;
