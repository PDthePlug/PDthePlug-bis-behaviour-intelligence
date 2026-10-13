import { z } from "zod";

export const EvidenceStageSchema = z.enum([
  "NOT_YET_EVIDENCED",
  "NOTICE",
  "EXPLAIN",
  "APPLY",
  "TEST_AND_REVISE",
  "TRANSFER",
]);
export type EvidenceStage = z.infer<typeof EvidenceStageSchema>;

export const EvidenceClassSchema = z.enum([
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
]);

export const SensitivitySchema = z.enum(["P0", "P1", "P2", "P3"]);
export const SourceNatureSchema = z.enum(["SELF_REPORT", "OBSERVED", "ASSESSED", "MIXED"]);

export const AllowedCompetencySchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(1200).default(""),
});

export const EvidenceContextSchema = z.object({
  evidenceId: z.string().min(1).max(200),
  labCode: z.string().min(1).max(100),
  labVersion: z.string().min(1).max(100),
  semanticFieldId: z.string().min(1).max(200),
  questionLabel: z.string().min(1).max(1200),
  portfolioPurpose: z.string().max(1600).default(""),
  authoredOutcome: z.string().max(1600).default(""),
  evidenceClass: EvidenceClassSchema,
  sensitivity: SensitivitySchema,
  sourceNature: SourceNatureSchema,
  mappingStatus: z.enum(["STRUCTURAL", "APPROVED"]),
  stageCeiling: EvidenceStageSchema,
  occurredAt: z.string().datetime().or(z.string().min(1)),
  learnerText: z.string().min(1).max(6000),
  allowedCompetencies: z.array(AllowedCompetencySchema).max(30),
  rubric: z
    .object({
      id: z.string().min(1).max(200),
      title: z.string().min(1).max(300),
      criteria: z.array(z.unknown()).max(20),
      scaleMin: z.number().int(),
      scaleMax: z.number().int(),
    })
    .nullable()
    .default(null),
});
export type EvidenceContext = z.infer<typeof EvidenceContextSchema>;

export const ResponseInterpretationSchema = z.object({
  meaningSummary: z.string().min(1).max(700),
  behaviouralSignals: z
    .array(
      z.object({
        signal: z.string().min(1).max(160),
        meaning: z.string().min(1).max(400),
      }),
    )
    .max(12),
  contextualQualifiers: z.array(z.string().min(1).max(300)).max(10),
  uncertainties: z.array(z.string().min(1).max(300)).max(10),
  sourceNature: SourceNatureSchema,
  confidence: z.number().min(0).max(1),
});
export type ResponseInterpretation = z.infer<typeof ResponseInterpretationSchema>;

export const EvidenceClassificationSchema = z.object({
  competencyIds: z.array(z.string().min(1).max(120)).max(8),
  evidenceClass: EvidenceClassSchema,
  proposedStage: EvidenceStageSchema,
  evidenceStrength: z.enum(["INSUFFICIENT", "WEAK", "MODERATE", "STRONG"]),
  claimStatus: z.enum(["NOT_SUPPORTED", "PROPOSED", "REVIEW_REQUIRED"]),
  rationale: z.string().min(1).max(700),
  confidence: z.number().min(0).max(1),
});
export type EvidenceClassification = z.infer<typeof EvidenceClassificationSchema>;

export const LongitudinalEvidenceItemSchema = z.object({
  evidenceId: z.string().min(1).max(200),
  occurredAt: z.string().min(1),
  competencyIds: z.array(z.string().min(1)).max(8),
  stage: EvidenceStageSchema,
  evidenceStrength: z.enum(["INSUFFICIENT", "WEAK", "MODERATE", "STRONG"]),
  confidence: z.number().min(0).max(1),
  sourceNature: SourceNatureSchema,
  meaningSummary: z.string().min(1).max(700),
  reviewStatus: z.enum(["PROPOSED", "REVIEW_REQUIRED", "REVIEWED", "REJECTED"]),
});

export const LongitudinalSynthesisSchema = z.object({
  competencyId: z.string().min(1).max(120),
  pattern: z.enum([
    "INSUFFICIENT_EVIDENCE",
    "EMERGING",
    "CONSISTENT",
    "INCONSISTENT",
    "REGRESSING",
    "TRANSFER_CANDIDATE",
  ]),
  highestSupportedStage: EvidenceStageSchema,
  evidenceCount: z.number().int().nonnegative(),
  synthesis: z.string().min(1).max(900),
  supportingEvidenceIds: z.array(z.string().min(1)).max(40),
  contradictoryEvidenceIds: z.array(z.string().min(1)).max(40),
  confidence: z.number().min(0).max(1),
  requiresHumanReview: z.boolean(),
});
export type LongitudinalSynthesis = z.infer<typeof LongitudinalSynthesisSchema>;

export const QualityContradictionSchema = z.object({
  verdict: z.enum(["SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "INSUFFICIENT"]),
  stageWithinSourceLimits: z.boolean(),
  competencyWithinAuthoredScope: z.boolean(),
  contradictions: z.array(z.string().min(1).max(400)).max(10),
  qualityFlags: z.array(z.string().min(1).max(400)).max(12),
  adjustedConfidence: z.number().min(0).max(1),
  requiresHumanReview: z.boolean(),
  rationale: z.string().min(1).max(900),
});
export type QualityContradiction = z.infer<typeof QualityContradictionSchema>;

export const ProgrammeAggregateSchema = z.object({
  cohortId: z.string().min(1).max(200),
  participantCount: z.number().int().nonnegative(),
  reportingStatus: z.string().min(1).max(200),
  minimumReportableCellSize: z.number().int().positive(),
  competencies: z
    .array(
      z.object({
        competencyId: z.string().min(1).max(120),
        label: z.string().min(1).max(200),
        reportableParticipants: z.number().int().nonnegative(),
        stageDistribution: z.record(z.string(), z.number().int().nonnegative()),
        evidenceStrengthDistribution: z.record(z.string(), z.number().int().nonnegative()).default({}),
        changeSignal: z.string().max(500).nullable().default(null),
      }),
    )
    .max(100),
  comparisonCoverage: z.array(z.unknown()).max(100).default([]),
  limitations: z.array(z.string().max(700)).max(30).default([]),
});
export type ProgrammeAggregate = z.infer<typeof ProgrammeAggregateSchema>;

export const ProgrammeInsightSchema = z.object({
  headline: z.string().min(1).max(240),
  findings: z.array(z.string().min(1).max(600)).max(8),
  supportPriorities: z.array(z.string().min(1).max(600)).max(6),
  limitations: z.array(z.string().min(1).max(600)).max(8),
  prohibitedClaimsAvoided: z.array(z.string().min(1).max(400)).max(8),
  confidence: z.number().min(0).max(1),
});
export type ProgrammeInsight = z.infer<typeof ProgrammeInsightSchema>;

export type AgentEnvelope<T> = {
  agent: "RESPONSE_INTERPRETATION" | "EVIDENCE_CLASSIFICATION" | "LONGITUDINAL_SYNTHESIS" | "QUALITY_CONTRADICTION" | "PROGRAMME_INSIGHT";
  promptVersion: string;
  model: string;
  output: T;
};
