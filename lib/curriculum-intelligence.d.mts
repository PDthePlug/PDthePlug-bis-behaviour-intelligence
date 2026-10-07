export type ReportEvidenceClassification =
  | "STARTING_POINT"
  | "LEARNING"
  | "GUIDED_APPLICATION"
  | "REAL_WORLD_APPLICATION"
  | "REVIEW_ADAPTATION"
  | "TRANSFER"
  | "LONGITUDINAL_PORTFOLIO"
  | "PROGRAMME_PATTERN";

export type CompetencyProgressStage =
  | "NOT_EVIDENCED"
  | "INTRODUCED"
  | "EXPLAINED"
  | "APPLIED_WITH_SUPPORT"
  | "DEMONSTRATED_IN_TASK"
  | "TESTED_IN_CONTEXT"
  | "REVIEWED_AND_ADAPTED"
  | "TRANSFERRED"
  | "SUSTAINED";

export type CompetencyEvidenceEvent = {
  kind: string;
  qualifies?: boolean;
  sourceRefs?: string[];
  evidenceRefs?: string[];
  cycleId?: string;
  longitudinal?: boolean;
};

export const REPORT_EVIDENCE_CLASSIFICATIONS: readonly ReportEvidenceClassification[];
export const COMPETENCY_PROGRESSION: readonly CompetencyProgressStage[];
export const COMPETENCY_STAGE_LABELS: Readonly<Record<CompetencyProgressStage, string>>;

export function classifyCompetencyProgress(input?: {
  introduced?: boolean;
  evidence?: CompetencyEvidenceEvent[];
}): CompetencyProgressStage;

export function buildCompetencyProgressSummary(input?: {
  competencyId?: string;
  label?: string;
  introduced?: boolean;
  evidence?: CompetencyEvidenceEvent[];
}): {
  competencyId: string;
  label: string;
  stage: CompetencyProgressStage;
  stageLabel: string;
  evidenceCount: number;
  sourceRefs: string[];
  evidenceRefs: string[];
  nextStep: string;
  boundary: string;
};

export function progressionDelta(
  preStage: CompetencyProgressStage,
  postStage: CompetencyProgressStage,
): number | null;

export function buildCompetencyTimeline(input?: {
  competencyId?: string;
  label?: string;
  introduced?: boolean;
  evidence?: Array<CompetencyEvidenceEvent & { at?: string }>;
}): {
  competencyId: string;
  label: string;
  initialStage: CompetencyProgressStage;
  currentStage: CompetencyProgressStage;
  progressionDelta: number | null;
  transitions: Array<{
    from: CompetencyProgressStage;
    to: CompetencyProgressStage;
    at: string | null;
    evidenceRefs: string[];
    sourceRefs: string[];
  }>;
  current: ReturnType<typeof buildCompetencyProgressSummary>;
};

