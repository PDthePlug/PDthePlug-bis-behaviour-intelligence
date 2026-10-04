export function structuralSupport(enrolment, experiment) {
  if (!enrolment) return "Help the learner access their assigned Lab.";
  if (enrolment.status === "COMPLETED") return "Support the next comparison and transfer plan without requesting private answers.";
  if (!enrolment.phaseACompletedAt && !experiment) return "Support completion of the existing Phase A tasks. Progress alone does not establish readiness or an outcome.";
  if (!experiment) return "Check the planned test and its calendar handoff.";
  if (!experiment.recordedDays) return "Check access to today's observation record. Empty records do not establish failure.";
  return "Support the experiment calendar and review handoff. Private interpretation remains with the learner.";
}

export function programmeEvidenceGuidance(outcome) {
  if (outcome.suppressed || !outcome.metrics || outcome.participantCount < Math.max(5, outcome.minimumReportableCohortSize ?? 5)) return null;
  const metrics = outcome.metrics;
  const observations = metrics.experiment.observationsRecorded;
  const opportunities = metrics.experiment.eligibleOpportunities;
  const sufficient = metrics.evidence.sufficient;
  const title = !observations ? "Outcomes are still awaiting observation" : !opportunities ? "Recorded days are not yet comparable opportunities" : !sufficient ? "Read results within their evidence limits" : "Compare results with their observation coverage";
  const summary = !observations
    ? "Starting-point responses describe the baseline. They do not establish behaviour change or programme effectiveness."
    : !opportunities ? "No-opportunity days are valid records. They are neither failure nor proof of improvement."
    : !sufficient ? "The comparison remains provisional because observations are limited."
    : "Review comparable measurement definitions and observation coverage. Association does not establish causation.";
  return {
    modelVersion: "bis-evidence-guidance:1", classificationStatus: "UNCLASSIFIED", confidence: null,
    title, summary,
    nextAction: !observations ? "Check the Lab handoff, record access and scheduled experiment window." : "Review coverage and repeat comparisons, then record the programme decision for the next comparable cohort.",
    sourceRefs: ["metrics.experiment.observationsRecorded", "metrics.experiment.eligibleOpportunities", "metrics.evidence.sufficient"],
  };
}
