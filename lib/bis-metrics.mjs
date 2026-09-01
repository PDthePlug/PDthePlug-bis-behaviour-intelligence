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
    opportunityCount === 0
      ? null
      : Math.round((replacementCount / opportunityCount) * 100);
  const predictionAccuracy =
    adherence === null
      ? null
      : Math.max(0, 100 - Math.abs(predictedAdherence - adherence));
  const evidenceStrength =
    opportunityCount === 0
      ? "NONE"
      : opportunityCount < 3
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
