export function structuralSupport(enrolment, experiment) {
  if (!enrolment) return "Help the learner access their assigned Lab.";
  if (enrolment.status === "COMPLETED") return "Support the next comparison and transfer plan without requesting private answers.";
  if (enrolment.experimentStartedAt && !experiment) return "Check the experiment dates and access to observation records. Observation counts are not available in this view.";
  if (!enrolment.phaseACompletedAt && !experiment) return "Help the learner finish their facilitated Lab activities. Progress alone does not establish readiness or an outcome.";
  if (!experiment) return "Check the planned test and its start date.";
  if (!experiment.recordedDays) return "Check access to today's observation record. Empty records do not establish failure.";
  return "Check the experiment dates and prepare for the evidence review. Personal reflections remain with the learner.";
}

export function programmeEvidenceGuidance(outcome) {
  const flow = outcome.evidenceFlow;
  if (flow?.runtimeMode === "DYNAMIC") {
    if (outcome.suppressed || flow.suppressed || !flow.totals || outcome.participantCount < Math.max(5, flow.minimumReportableCohortSize ?? 5)) return null;
    return {
      modelVersion: "bis-evidence-guidance:1", classificationStatus: "UNCLASSIFIED", confidence: null,
      title: "What the evidence shows so far",
      summary: "Recorded responses, measures with source evidence and completed stages describe how much information is available. These counts do not establish behaviour change or programme effectiveness. Small groups remain hidden for privacy.",
      nextAction: "Review the published Lab's measure definitions, experiment window and evidence coverage before recording the next programme decision.",
      sourceRefs: ["evidenceFlow.totals", "evidenceFlow.stages"],
    };
  }
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
