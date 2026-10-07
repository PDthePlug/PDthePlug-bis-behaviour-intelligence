export const REPORT_CLASSIFICATION_VERSION = "bis-report-classification:1";

const DEFINITIONS = Object.freeze({
  LEARNER_PROGRESS_REPORT: Object.freeze({
    id: "LEARNER_PROGRESS_REPORT",
    label: "Learner progress report",
    scope: "individual",
    claimMode: "EVIDENCE_BACKED_PROGRESSION",
  }),
  COMPETENCY_EVIDENCE_REPORT: Object.freeze({
    id: "COMPETENCY_EVIDENCE_REPORT",
    label: "Competency evidence report",
    scope: "individual",
    claimMode: "MAPPED_TASK_EVIDENCE",
  }),
  EVIDENCE_PORTFOLIO: Object.freeze({
    id: "EVIDENCE_PORTFOLIO",
    label: "Evidence portfolio",
    scope: "individual_longitudinal",
    claimMode: "PROVENANCE_FIRST",
  }),
  FACILITATOR_SUPPORT_REPORT: Object.freeze({
    id: "FACILITATOR_SUPPORT_REPORT",
    label: "Facilitator support report",
    scope: "individual_support",
    claimMode: "STRUCTURAL_SUPPORT",
  }),
  COHORT_LEARNING_REPORT: Object.freeze({
    id: "COHORT_LEARNING_REPORT",
    label: "Cohort learning report",
    scope: "aggregate_cohort",
    claimMode: "PRIVACY_SAFE_AGGREGATE",
  }),
  SPONSOR_OUTCOME_REPORT: Object.freeze({
    id: "SPONSOR_OUTCOME_REPORT",
    label: "Sponsor outcome report",
    scope: "aggregate_programme",
    claimMode: "DESCRIPTIVE_OUTCOME_EVIDENCE",
  }),
  IMPLEMENTATION_QUALITY_REPORT: Object.freeze({
    id: "IMPLEMENTATION_QUALITY_REPORT",
    label: "Implementation quality report",
    scope: "delivery",
    claimMode: "DELIVERY_FIDELITY",
  }),
  LONGITUDINAL_PATHWAY_REPORT: Object.freeze({
    id: "LONGITUDINAL_PATHWAY_REPORT",
    label: "Longitudinal pathway report",
    scope: "longitudinal",
    claimMode: "VERSIONED_PROGRESSION",
  }),
});

export function reportClassification(id) {
  const value = DEFINITIONS[String(id ?? "").toUpperCase()];
  if (!value) throw new Error(`Unknown BIS report classification: ${id}`);
  return { ...value, modelVersion: REPORT_CLASSIFICATION_VERSION };
}

export function reportClassificationIds() {
  return Object.keys(DEFINITIONS);
}
