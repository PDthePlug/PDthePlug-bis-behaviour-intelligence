import assert from "node:assert/strict";
import test from "node:test";

import { computeHabitMetrics } from "../lib/bis-metrics.mjs";

test("calculates adherence and prediction accuracy from eligible opportunities", () => {
  const metrics = computeHabitMetrics(
    [true, true, true, true, false].map((used) => ({
      eligibleOpportunity: true,
      alternativeUsed: used,
    })),
    70,
  );

  assert.deepEqual(metrics, {
    opportunityCount: 5,
    replacementCount: 4,
    adherence: 80,
    predictionAccuracy: 90,
    evidenceStrength: "SUFFICIENT_FOR_LAB",
  });
});

test("preserves no opportunity as not applicable", () => {
  const metrics = computeHabitMetrics(
    [{ eligibleOpportunity: false, alternativeUsed: null }],
    60,
  );

  assert.deepEqual(metrics, {
    opportunityCount: 0,
    replacementCount: 0,
    adherence: null,
    predictionAccuracy: null,
    evidenceStrength: "NONE",
  });
});

test("labels one perfect opportunity as limited evidence", () => {
  const metrics = computeHabitMetrics(
    [{ eligibleOpportunity: true, alternativeUsed: true }],
    100,
  );

  assert.deepEqual(metrics, {
    opportunityCount: 1,
    replacementCount: 1,
    adherence: 100,
    predictionAccuracy: 100,
    evidenceStrength: "LIMITED",
  });
});

test("excludes no-opportunity days instead of scoring them as failures", () => {
  const metrics = computeHabitMetrics(
    [
      { eligibleOpportunity: false, alternativeUsed: null },
      { eligibleOpportunity: true, alternativeUsed: true },
      { eligibleOpportunity: true, alternativeUsed: false },
      { eligibleOpportunity: false, alternativeUsed: null },
    ],
    60,
  );

  assert.deepEqual(metrics, {
    opportunityCount: 2,
    replacementCount: 1,
    adherence: 50,
    predictionAccuracy: 90,
    evidenceStrength: "LIMITED",
  });
});
