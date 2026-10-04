/**
 * Calculate the Habit Lab experiment measures without collapsing missingness.
 *
 * @param {Array<{eligibleOpportunity: boolean | null, alternativeUsed: boolean | null}>} events
 * @param {number} predictedAdherence
 */
export function computeHabitMetrics(events, predictedAdherence) {
  const eligible = events.filter((event) => event.eligibleOpportunity === true);
  const opportunityCount = eligible.length;
  const replacementCount = eligible.filter(
    (event) => event.alternativeUsed === true,
  ).length;
  const adherence =
    opportunityCount === 0 || eligible.some(event => typeof event.alternativeUsed !== "boolean")
      ? null
      : Math.round((replacementCount / opportunityCount) * 100);
  const predictionAccuracy =
    adherence === null || typeof predictedAdherence !== "number" || !Number.isFinite(predictedAdherence) || predictedAdherence < 0 || predictedAdherence > 100
      ? null
      : Math.max(0, 100 - Math.abs(predictedAdherence - adherence));
  const evidenceStrength =
    opportunityCount === 0
      ? "NONE"
      : opportunityCount < 3 || adherence === null
        ? "LIMITED"
        : "SUFFICIENT_FOR_LAB";

  return {
    opportunityCount,
    replacementCount,
    adherence,
    predictionAccuracy,
    evidenceStrength,
  };
}

export function validateHabitObservation(targetConditionOccurred, alternativeUsed) {
  if (typeof targetConditionOccurred !== "boolean") throw new Error("Record whether the target condition occurred today.");
  if (targetConditionOccurred && typeof alternativeUsed !== "boolean") throw new Error("Record whether you used the alternative response for this opportunity.");
  return { targetConditionOccurred, alternativeUsed: targetConditionOccurred ? alternativeUsed : null };
}
