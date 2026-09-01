import assert from "node:assert/strict";
import test from "node:test";

import { getExperimentTiming } from "../lib/experiment-timing.mjs";

const experiment = {
  startDate: "2026-09-05",
  plannedEndDate: "2026-09-11",
  status: "ACTIVE",
};

test("does not unlock day one before the experiment starts", () => {
  const timing = getExperimentTiming(experiment, [], "2026-09-04");
  assert.equal(timing.status, "BEFORE_START");
  assert.equal(timing.availableDay, 0);
  assert.equal(timing.canClose, false);
});

test("opens only the calendar day the learner has actually reached", () => {
  const timing = getExperimentTiming(experiment, [{ dayNumber: 1 }], "2026-09-07");
  assert.equal(timing.status, "READY_TODAY");
  assert.equal(timing.calendarDay, 3);
  assert.equal(timing.availableDay, 3);
  assert.equal(timing.suggestedDay, 3);
});

test("moves into a useful waiting state after today's observation", () => {
  const timing = getExperimentTiming(
    experiment,
    [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 3 }],
    "2026-09-07",
  );
  assert.equal(timing.status, "WAITING_NEXT_DAY");
  assert.equal(timing.nextUnlockDate, "2026-09-08");
  assert.equal(timing.canClose, false);
});

test("keeps an earlier missing day available without unlocking the future", () => {
  const timing = getExperimentTiming(
    experiment,
    [{ dayNumber: 1 }, { dayNumber: 3 }],
    "2026-09-07",
  );
  assert.equal(timing.status, "CATCH_UP_AVAILABLE");
  assert.equal(timing.missingAvailableDay, 2);
  assert.equal(timing.availableDay, 3);
});

test("closes only after the final day is recorded or fully elapsed", () => {
  const early = getExperimentTiming(experiment, [{ dayNumber: 1 }], "2026-09-11");
  const recorded = getExperimentTiming(experiment, [{ dayNumber: 7 }], "2026-09-11");
  const elapsed = getExperimentTiming(experiment, [], "2026-09-12");
  assert.equal(early.canClose, false);
  assert.equal(recorded.canClose, true);
  assert.equal(elapsed.canClose, true);
});
