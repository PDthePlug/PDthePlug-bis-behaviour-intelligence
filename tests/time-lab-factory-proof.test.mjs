import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateUniversalComputed,
  upgradeUniversalLabV2,
  validateUniversalCalculations,
} from "../lib/universal-lab-v2.mjs";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";

const cartridgeUrl = new URL("../content/cartridges/time-v1.0.json", import.meta.url);

async function timeSource() {
  return JSON.parse(await readFile(cartridgeUrl, "utf8"));
}

function representativeResponses() {
  const values = {
    "TIM.I1.AWARE_PRE": 4,
    "TIM.I5.CONFIDENCE_PRE": 5,
    "TIM.I6.PREDICTED_ADHERENCE": 70,
    "TIM.I8.AWARE_POST": 8,
    "TIM.I8.CONFIDENCE_POST": 7,
    "TIM.I2.PATTERN": "I lose the first part of my work block before I start.",
    "TIM.I6.TARGET": "The first planned work block of the evening.",
    "TIM.I4.TIME_STEAL": "Phone checks and preparing to start.",
    "TIM.I4.INTENTION": "Begin the planned work.",
    "TIM.I4.SMALLEST": "Open the document and write one sentence.",
    "TIM.I4.PROTECT": "Move the phone and close messages.",
    "TIM.I4.LEAK": "The gap between sitting down and beginning.",
    "TIM.I5.EQUATION": "When I sit down without a first step, I drift before starting.",
    "TIM.I9.IDENTITY_SHIFT": "I notice where my attention goes before I give the time away.",
  };

  const idealBaseline = {
    KNOW: "Always",
    NO_TIME: "Never",
    UNNOTICED: "Never",
    PRIORITISE: "Always",
    SAY_YES: "Never",
    GUILT: "Never",
    MATTERS: "Always",
    PROTECT: "Always",
    STEALS: "Always",
    CONTROL: "Always",
  };
  for (const [suffix, value] of Object.entries(idealBaseline)) {
    values[`TIM.I1.BASELINE.${suffix}`] = value;
  }

  for (let day = 1; day <= 7; day += 1) {
    values[`TIM.I7.D${day}.ELIGIBLE`] = day <= 5 ? "Yes" : "No";
    values[`TIM.I7.D${day}.PAUSE`] = day <= 4 ? "Yes" : day === 5 ? "No" : "N/A";
    values[`TIM.I7.D${day}.RECLAIMED`] = [1, 2, 4].includes(day) ? "Yes" : day <= 4 ? "No" : "N/A";
  }
  return values;
}

test("Time Lab cartridge uses the shared nine-investigation factory contract", async () => {
  const source = await timeSource();
  assert.equal(source.identity.code, "TIM");
  assert.equal(source.investigations.length, 9);
  assert.deepEqual(source.investigations.map((item) => item.number), [1,2,3,4,5,6,7,8,9]);
  assert.equal(source.factoryCapabilities.experiment.days, 7);
  assert.equal(source.factoryCapabilities.repeatableEvidenceTable, true);
  assert.equal(source.factoryCapabilities.profileSummary, true);
  assert.deepEqual(source.factoryCapabilities.indicatorCodes, [
    "BEI-01","BEI-02","BEI-03","BEI-04","BEI-05",
    "BEI-06","BEI-07","BEI-08","BEI-09","BEI-10",
  ]);
});

test("Universal V2 preserves authored Time calculations and binds all ten BEIs", async () => {
  const upgraded = upgradeUniversalLabV2(await timeSource());

  assert.equal(upgraded.schemaVersion, "universal-lab-v2");
  assert.equal(upgraded.runtimeProfile, "UNIVERSAL_V2");
  assert.equal(upgraded.experiment.investigation, 7);
  assert.equal(upgraded.experiment.days, 7);
  assert.deepEqual([...new Set(upgraded.experiment.scheduledPromptIds.map((item) => item.day))], [1,2,3,4,5,6,7]);
  assert.deepEqual(upgraded.indicatorRegistry.map((item) => item.code), [
    "BEI-01","BEI-02","BEI-03","BEI-04","BEI-05",
    "BEI-06","BEI-07","BEI-08","BEI-09","BEI-10",
  ]);
  assert.ok(upgraded.indicatorRegistry.every((item) => item.status === "BOUND"));

  const operations = new Map(upgraded.computedFields.map((item) => [item.id, item.operation]));
  assert.equal(operations.get("TIM.I1.RISK_INDEX"), "LIKERT_RISK_INDEX");
  assert.equal(operations.get("TIM.I8.ELIGIBLE_COUNT"), "COUNT_EQUALS");
  assert.equal(operations.get("TIM.I8.ADHERENCE"), "RATIO_PERCENT");
  assert.equal(operations.get("TIM.I8.PREDICTION_ACCURACY"), "ACCURACY_PERCENT");
  assert.equal(operations.get("TIM.I9.PROFILE"), "COLLECTION");
  assert.doesNotThrow(() => validateUniversalCalculations(upgraded));
});

test("Time evidence math excludes no-opportunity days and keeps missing data distinct", async () => {
  const upgraded = upgradeUniversalLabV2(await timeSource());
  const computed = evaluateUniversalComputed(upgraded, representativeResponses());

  assert.equal(computed["TIM.I1.RISK_INDEX"], 0);
  assert.equal(computed["TIM.I8.ELIGIBLE_COUNT"], 5);
  assert.equal(computed["TIM.I8.FULL_COUNT"], 4);
  assert.equal(computed["TIM.I8.ADHERENCE"], 80);
  assert.equal(computed["TIM.I8.PREDICTION_ACCURACY"], 90);
  assert.equal(computed["TIM.I8.RECLAIMED_COUNT"], 3);
  assert.equal(computed["TIM.I8.RECLAIM_RATE"], 75);
  assert.equal(computed["TIM.I8.AWARE_SHIFT"], 4);
  assert.equal(computed["TIM.I8.CONFIDENCE_SHIFT"], 2);
  assert.match(computed["TIM.I9.PROFILE"], /I lose the first part of my work block/);
  assert.match(computed["TIM.I9.PROFILE"], /80/);
});

test("Time adherence is N/A when there are no eligible opportunities", async () => {
  const upgraded = upgradeUniversalLabV2(await timeSource());
  const values = representativeResponses();
  for (let day = 1; day <= 7; day += 1) {
    values[`TIM.I7.D${day}.ELIGIBLE`] = "No";
    values[`TIM.I7.D${day}.PAUSE`] = "N/A";
    values[`TIM.I7.D${day}.RECLAIMED`] = "N/A";
  }
  const computed = evaluateUniversalComputed(upgraded, values);
  assert.equal(computed["TIM.I8.ELIGIBLE_COUNT"], 0);
  assert.equal(computed["TIM.I8.FULL_COUNT"], 0);
  assert.equal(computed["TIM.I8.ADHERENCE"], null);
  assert.equal(computed["TIM.I8.PREDICTION_ACCURACY"], null);
  assert.equal(computed["TIM.I8.RECLAIM_RATE"], null);
});

test("Time cartridge compiles through the real governed Lab compiler without a TIM-specific runtime branch", async () => {
  const tools = await loadContentTools();
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(await timeSource()));
    const artifact = await tools.compileUniversalLab(bytes, "TIM", "1.0");
    const compiled = JSON.parse(artifact.content);

    assert.equal(compiled.identity.code, "TIM");
    assert.equal(compiled.runtimeProfile, "UNIVERSAL_V2");
    assert.equal(compiled.schemaVersion, "universal-lab-v2");
    assert.equal(compiled.investigations.length, 9);
    assert.equal(compiled.experiment.days, 7);
    assert.equal(compiled.profile.investigation, 9);
    assert.equal(compiled.computedFields.find((item) => item.id === "TIM.I8.ADHERENCE").operation, "RATIO_PERCENT");
  } finally {
    await tools.dispose();
  }
});

test("Universal Lab V2 remains generic: Time introduces no TIM-coded engine branch", async () => {
  const engine = await readFile(new URL("../lib/universal-lab-v2.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(engine, /\bTIM\b/);
});
