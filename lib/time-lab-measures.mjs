export const TIME_LAB_BEI = Object.freeze([
  { code: "BEI-01", key: "TIME_AWARENESS_PRE", label: "Time Awareness Index (Pre)", phase: "PRE", kind: "RATING_1_10" },
  { code: "BEI-02", key: "TIME_BASELINE_PROFILE", label: "Time Baseline Profile", phase: "PRE", kind: "LIKERT_PROFILE" },
  { code: "BEI-03", key: "PREDICTED_ADHERENCE", label: "Predicted Time Pause Adherence", phase: "PRE", kind: "PERCENT" },
  { code: "BEI-04", key: "TIME_CONFIDENCE_PRE", label: "Time Confidence Index (Pre)", phase: "PRE", kind: "RATING_1_10" },
  { code: "BEI-05", key: "TIME_RISK_INDEX", label: "Time Risk Index", phase: "PRE", kind: "DERIVED_0_100" },
  { code: "BEI-06", key: "TIME_ADHERENCE_RATE", label: "Time Adherence Rate", phase: "POST", kind: "DERIVED_PERCENT" },
  { code: "BEI-07", key: "TIME_AWARENESS_POST", label: "Time Awareness Index (Post)", phase: "POST", kind: "RATING_1_10" },
  { code: "BEI-08", key: "TIME_CONFIDENCE_POST", label: "Time Confidence Index (Post)", phase: "POST", kind: "RATING_1_10" },
  { code: "BEI-09", key: "IDENTITY_SHIFT", label: "Identity Shift Indicator", phase: "POST", kind: "TEXT" },
  { code: "BEI-10", key: "TIME_INVESTIGATION_PROFILE", label: "Time Investigation Profile", phase: "POST", kind: "PROFILE" },
]);

export const TIME_BASELINE_BEHAVIOURS = Object.freeze([
  { key: "know_where_time_goes", direction: "PROTECTIVE" },
  { key: "feel_like_no_time", direction: "RISK" },
  { key: "waste_time_without_realising", direction: "RISK" },
  { key: "prioritise_what_matters", direction: "PROTECTIVE" },
  { key: "say_yes_when_should_say_no", direction: "RISK" },
  { key: "feel_guilty_about_time", direction: "RISK" },
  { key: "have_time_for_what_matters", direction: "PROTECTIVE" },
  { key: "protect_time_from_others", direction: "PROTECTIVE" },
  { key: "know_what_steals_time", direction: "PROTECTIVE" },
  { key: "control_over_schedule", direction: "PROTECTIVE" },
]);

export const TIME_LIKERT = Object.freeze({
  Never: 1,
  Rarely: 2,
  Sometimes: 3,
  Often: 4,
  Always: 5,
});

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function boundedPercent(value) {
  if (!finite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export function timeAdherenceRate({ fullPauses, eligibleOpportunities }) {
  if (!finite(fullPauses) || !finite(eligibleOpportunities) || eligibleOpportunities <= 0) return null;
  return boundedPercent((fullPauses / eligibleOpportunities) * 100);
}

export function predictionAccuracy({ predictedAdherence, actualAdherence }) {
  if (!finite(predictedAdherence) || !finite(actualAdherence)) return null;
  return boundedPercent(100 - Math.abs(predictedAdherence - actualAdherence));
}

export function reclaimRate({ reclaimedFullPauses, fullPauses }) {
  if (!finite(reclaimedFullPauses) || !finite(fullPauses) || fullPauses <= 0) return null;
  return boundedPercent((reclaimedFullPauses / fullPauses) * 100);
}

export function timeRiskIndex(profile) {
  if (!profile || typeof profile !== "object") return null;
  const scores = TIME_BASELINE_BEHAVIOURS.map(({ key, direction }) => {
    const raw = profile[key];
    const numeric = typeof raw === "string" ? TIME_LIKERT[raw] : raw;
    if (!finite(numeric) || numeric < 1 || numeric > 5) return null;
    return direction === "RISK" ? numeric : 6 - numeric;
  });
  if (scores.some((value) => value === null)) return null;
  const meanRisk = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return boundedPercent(((meanRisk - 1) / 4) * 100);
}

export function timeInvestigationSummary(input) {
  const adherence = timeAdherenceRate({
    fullPauses: input.fullPauses,
    eligibleOpportunities: input.eligibleOpportunities,
  });
  return {
    timePattern: input.timePattern ?? "",
    targetCondition: input.targetCondition ?? "",
    timeSteal: input.timeSteal ?? "",
    intention: input.intention ?? "",
    smallestFirstStep: input.smallestFirstStep ?? "",
    protectingMove: input.protectingMove ?? "",
    timeLeak: input.timeLeak ?? "",
    workingEquation: input.workingEquation ?? "",
    adherenceRate: adherence,
    predictionAccuracy: predictionAccuracy({
      predictedAdherence: input.predictedAdherence,
      actualAdherence: adherence,
    }),
    reclaimRate: reclaimRate({
      reclaimedFullPauses: input.reclaimedFullPauses,
      fullPauses: input.fullPauses,
    }),
    awarenessShift:
      finite(input.awarenessPre) && finite(input.awarenessPost)
        ? input.awarenessPost - input.awarenessPre
        : null,
    confidenceShift:
      finite(input.confidencePre) && finite(input.confidencePost)
        ? input.confidencePost - input.confidencePre
        : null,
    identityShift: input.identityShift ?? "",
  };
}
