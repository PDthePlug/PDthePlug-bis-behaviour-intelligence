import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateUniversalComputed,
  universalComputedLeafInputs,
  universalExperimentEvidenceProgress,
  universalExperimentReviewReady,
} from "../lib/universal-lab-v2.mjs";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Universal V2 calculation provenance resolves back to learner evidence leaves", () => {
  const definition = {
    computedFields: [
      { id: "RSK.I4.SCORE", operation: "PRODUCT", inputs: ["RSK.I4.P", "RSK.I4.M"], precision: 0 },
      { id: "RSK.I9.PROFILE_SCORE", operation: "COPY", inputs: ["RSK.I4.SCORE"] },
    ],
  };
  assert.deepEqual(
    universalComputedLeafInputs(definition, "RSK.I9.PROFILE_SCORE").sort(),
    ["RSK.I4.M", "RSK.I4.P"],
  );
  assert.deepEqual(
    evaluateUniversalComputed(definition, { "RSK.I4.P": 4, "RSK.I4.M": 5 }),
    { "RSK.I4.SCORE": 20, "RSK.I9.PROFILE_SCORE": 20 },
  );
});

test("Universal Lab responses enter the shared evidence registry", async () => {
  const route = await source("app/api/universal-lab/route.ts");
  assert.match(route, /evidenceRecords/);
  assert.match(route, /sourceObjectType: "RESPONSE"/);
  assert.match(route, /provenance: "SR"/);
  assert.match(route, /status: responseStatus === "PASS" \? "WITHDRAWN" : "ACTIVE"/);
  assert.match(route, /status: "SUPERSEDED"/);
});

test("Universal V2 derived values persist as enrolment-scoped measurements with source provenance", async () => {
  const [route, schema, migration] = await Promise.all([
    source("app/api/universal-lab/route.ts"),
    source("db/schema.ts"),
    source("supabase/migrations/20261001103000_universal_lab_measurement_scope.sql"),
  ]);

  assert.match(route, /syncUniversalComputedMeasurements/);
  assert.match(route, /measurementValues/);
  assert.match(route, /measurementSources/);
  assert.match(route, /universalComputedLeafInputs/);
  assert.match(route, /formulaVersion/);
  assert.match(route, /universal-lab-v2:computed/);
  assert.match(route, /universal-lab-v2:bei/);
  assert.match(route, /indicatorRegistry/);
  assert.match(route, /indicator\.code\.replace\("-", ""\)/);
  assert.match(route, /sourceObjectType: "RESPONSE"/);
  assert.match(schema, /enrolmentId: text\("enrolment_id"\)/);
  assert.match(schema, /uq_measurement_user_enrolment_code/);
  assert.match(migration, /add column if not exists enrolment_id text/);
  assert.match(migration, /where enrolment_id is not null/);
});


test("Universal experiment progress counts completed calendar-day evidence without inventing event rows", () => {
  const definition = {
    experiment: {
      investigation: 7,
      startAfterInvestigation: 6,
      days: 3,
      reviewInvestigation: 8,
      scheduledPromptIds: [
        { day: 1, promptId: "TST.I7.D1.A" },
        { day: 1, promptId: "TST.I7.D1.B" },
        { day: 2, promptId: "TST.I7.D2.A" },
        { day: 2, promptId: "TST.I7.D2.B" },
        { day: 3, promptId: "TST.I7.D3.A" },
      ],
    },
    investigations: [{
      number: 7,
      prompts: [
        { id: "TST.I7.D1.A", required: true },
        { id: "TST.I7.D1.B", required: true },
        { id: "TST.I7.D2.A", required: true },
        { id: "TST.I7.D2.B", required: true },
        { id: "TST.I7.D3.A", required: true },
      ],
    }],
  };

  const progress = universalExperimentEvidenceProgress(definition, {
    "TST.I7.D1.A": { status: "ANSWERED" },
    "TST.I7.D1.B": { status: "PASS" },
    "TST.I7.D2.A": { status: "ANSWERED" },
  }, 2);

  assert.deepEqual(progress, {
    experimentStarted: true,
    currentDay: 2,
    totalDays: 3,
    evidenceDaysRecorded: 1,
    todayEvidenceRecorded: false,
  });

  const completedToday = universalExperimentEvidenceProgress(definition, {
    "TST.I7.D1.A": { status: "ANSWERED" },
    "TST.I7.D1.B": { status: "PASS" },
    "TST.I7.D2.A": { status: "ANSWERED" },
    "TST.I7.D2.B": { status: "ANSWERED" },
  }, 2);

  assert.equal(completedToday.evidenceDaysRecorded, 2);
  assert.equal(completedToday.todayEvidenceRecorded, true);
});

test("Universal Evidence Review waits for the final observation or the closed calendar window", () => {
  assert.equal(universalExperimentReviewReady({
    currentDay: 7,
    totalDays: 7,
    todayEvidenceRecorded: false,
  }), false);
  assert.equal(universalExperimentReviewReady({
    currentDay: 7,
    totalDays: 7,
    todayEvidenceRecorded: true,
  }), true);
  assert.equal(universalExperimentReviewReady({
    currentDay: 8,
    totalDays: 7,
    todayEvidenceRecorded: false,
  }), true);
});

test("Universal experiment progress supports authored windows longer than seven days", () => {
  const scheduledPromptIds = Array.from({ length: 30 }, (_, index) => ({
    day: index + 1,
    promptId: `LCH.I7.DAY${index + 1}`,
  }));
  const prompts = scheduledPromptIds.map(({ promptId }) => ({ id: promptId, required: true }));
  const responses = Object.fromEntries(
    scheduledPromptIds.slice(0, 12).map(({ promptId }) => [promptId, { status: "ANSWERED" }]),
  );

  const progress = universalExperimentEvidenceProgress({
    experiment: {
      investigation: 7,
      startAfterInvestigation: 6,
      days: 30,
      reviewInvestigation: 8,
      scheduledPromptIds,
    },
    investigations: [{ number: 7, prompts }],
  }, responses, 12);

  assert.equal(progress.currentDay, 12);
  assert.equal(progress.totalDays, 30);
  assert.equal(progress.evidenceDaysRecorded, 12);
  assert.equal(progress.todayEvidenceRecorded, true);
});
