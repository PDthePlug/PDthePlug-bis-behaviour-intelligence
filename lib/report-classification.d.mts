export type BisReportClassificationId =
  | "LEARNER_PROGRESS_REPORT"
  | "COMPETENCY_EVIDENCE_REPORT"
  | "EVIDENCE_PORTFOLIO"
  | "FACILITATOR_SUPPORT_REPORT"
  | "COHORT_LEARNING_REPORT"
  | "SPONSOR_OUTCOME_REPORT"
  | "IMPLEMENTATION_QUALITY_REPORT"
  | "LONGITUDINAL_PATHWAY_REPORT";

export type BisReportClassification = {
  id: BisReportClassificationId;
  label: string;
  scope: string;
  claimMode: string;
  modelVersion: string;
};

export const REPORT_CLASSIFICATION_VERSION: string;
export function reportClassification(id: BisReportClassificationId | string): BisReportClassification;
export function reportClassificationIds(): string[];
