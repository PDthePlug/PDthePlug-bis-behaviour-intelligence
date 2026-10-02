import assert from "node:assert/strict";
import test from "node:test";
import { isIsoDate, normalizePromptResponseValue, ratingShift, todayInZone, validPromptResponse } from "../lib/evidence-validation.mjs";
import { getExperimentTiming } from "../lib/experiment-timing.mjs";

test("rating shifts require two actual bounded observations", () => {
  for (const value of [null, undefined, "", "5", false, NaN, Infinity, 0, 11, 1.5]) {
    assert.equal(ratingShift(value, 5), null);
    assert.equal(ratingShift(5, value), null);
  }
  assert.equal(ratingShift(3, 8), 5);
  assert.equal(ratingShift(8, 3), -5);
  assert.equal(ratingShift(5, 5), 0);
});

test("experiment dates reject normalized and invalid calendar days", () => {
  for (const value of ["2026-02-29", "2026-02-31", "2026-13-01", "2026-9-01", "no", null]) assert.equal(isIsoDate(value), false);
  assert.equal(isIsoDate("2024-02-29"), true);
  assert.equal(isIsoDate("2026-09-29"), true);
});

test("South African midnight unlocks only the local calendar day", () => {
  const experiment = { startDate: "2026-09-30", plannedEndDate: "2026-10-06", status: "ACTIVE" };
  const before = todayInZone(new Date("2026-09-29T21:59:59Z"));
  const after = todayInZone(new Date("2026-09-29T22:00:00Z"));
  assert.equal(getExperimentTiming(experiment, [], before).availableDay, 0);
  assert.equal(getExperimentTiming(experiment, [], after).availableDay, 1);
  assert.equal(getExperimentTiming(experiment, [{ dayNumber: 7 }], after).canClose, false);
});

test("todayInZone accepts an explicit timezone without treating it as the date value", () => {
  const instant = new Date("2026-10-02T17:00:00Z");
  assert.equal(todayInZone(instant, "Africa/Johannesburg"), "2026-10-02");
  assert.doesNotThrow(() => todayInZone("Africa/Johannesburg"));
});

test("dynamic responses respect typed controls, required fields and the right to pass", () => {
  const rating = { type: "INTEGER", min: 1, max: 5 };
  assert.equal(validPromptResponse(rating, "3"), true);
  for (const value of ["", "6", "NaN", "1.5", "1e2", 3]) assert.equal(validPromptResponse(rating, value), false);
  assert.equal(validPromptResponse(rating, "", "PASS"), true);
  assert.equal(validPromptResponse({ type: "TEXT", required: false }, ""), true);
  assert.equal(validPromptResponse({ type: "BOOLEAN" }, "No"), true);
  assert.equal(validPromptResponse({ type: "BOOLEAN" }, "maybe"), false);
  assert.equal(validPromptResponse({ type: "DATE" }, "2026-02-31"), false);
  const multi = { type: "MULTI_SELECT", options: ["A", "B"] };
  assert.equal(validPromptResponse(multi, '["A","B"]'), true);
  for (const value of ['[]', '["C"]', '["A","A"]', '{}']) assert.equal(validPromptResponse(multi, value), false);
});


test("legacy Investigation 7 typed values normalize to canonical evidence values", () => {
  const booleanPrompt = { type: "BOOLEAN", required: true };
  assert.equal(normalizePromptResponseValue(booleanPrompt, "No i did not"), "No");
  assert.equal(normalizePromptResponseValue(booleanPrompt, "Yes, I did"), "Yes");
  assert.equal(normalizePromptResponseValue(booleanPrompt, "maybe"), "maybe");
  assert.equal(validPromptResponse(booleanPrompt, normalizePromptResponseValue(booleanPrompt, "No i did not")), true);

  const datePrompt = { type: "DATE", required: false };
  assert.equal(normalizePromptResponseValue(datePrompt, "02/10/2026"), "2026-10-02");
  assert.equal(validPromptResponse(datePrompt, normalizePromptResponseValue(datePrompt, "02/10/2026")), true);
});
