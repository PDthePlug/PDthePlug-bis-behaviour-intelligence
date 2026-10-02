import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectLabSourceCapabilities, capabilitySummary } from "../lib/lab-factory-capabilities.mjs";
import {
  evaluateUniversalComputed,
  experimentCalendarDay,
  upgradeUniversalLabV2,
} from "../lib/universal-lab-v2.mjs";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

const riskSourceSignatures = `
# RISK LAB™
Learner Workbook — Version 3.0 (System-Aligned, Universe-Ready)

### BEHAVIOUR EVIDENCE INDICATOR (BEI) SYSTEM
BEI-01 Risk Awareness Index (Pre)
BEI-02 Risk Baseline Profile
BEI-03 Prediction Calibration Score
BEI-04 Risk Confidence Index (Pre)
BEI-05 Risk Index
BEI-06 Experiment Adherence Rate
BEI-07 Risk Awareness Shift Index
BEI-08 Risk Confidence Index (Post)
BEI-09 Identity Shift Indicator
BEI-10 Behaviour Profile Summary

### RISK BASELINE — PRE

### INVESTIGATION 4 — RISK MAPPING
Probability (1–5)
Magnitude (1–5)
Risk Score (P × M)
Probability × Magnitude = Risk Score

### INVESTIGATION 7 — 7-DAY EXPERIMENT
Day
Date
Action I Took
Did I take action?
Notes
BEI-06: Days Completed: ___ / 7
Risk Actions Taken: ___ / 7

### INVESTIGATION 8 — EVIDENCE REVIEW
Shift: ___ points (BEI-07 - BEI-01)
Shift: ___ points (BEI-08 - BEI-04)

### INVESTIGATION 9 — BEHAVIOUR PROFILE
BEHAVIOUR PROFILE SUMMARY

### RISK TRANSFORMATION CERTIFICATE
`;

test("Risk Lab is detected as a full behavioural-runtime stress case", () => {
  const capabilities = inspectLabSourceCapabilities(riskSourceSignatures);

  assert.equal(capabilities.baseline, true);
  assert.deepEqual(capabilities.indicatorCodes, [
    "BEI-01", "BEI-02", "BEI-03", "BEI-04", "BEI-05",
    "BEI-06", "BEI-07", "BEI-08", "BEI-09", "BEI-10",
  ]);
  assert.equal(capabilities.experiment.detected, true);
  assert.equal(capabilities.experiment.days, 7);
  assert.equal(capabilities.repeatableEvidenceTable, true);
  assert.equal(capabilities.profileSummary, true);
  assert.equal(capabilities.certificate, true);
  assert.ok(capabilities.derivedSignatures.length >= 3);
  assert.equal(capabilities.requiresBehaviourRuntimeV2, true);

  const summary = capabilitySummary(capabilities);
  assert.ok(summary.includes("10 BEIs"));
  assert.ok(summary.includes("derived calculations"));
  assert.ok(summary.includes("7-day experiment"));
  assert.ok(summary.includes("repeatable evidence table"));
  assert.ok(summary.includes("behaviour profile"));
});

test("document adapters carry factory capabilities into generated Lab packages", async () => {
  const adapter = await source("lib/content-source-adapters.ts");

  assert.match(adapter, /inspectLabSourceCapabilities/);
  assert.match(adapter, /factoryCapabilities: inspectLabSourceCapabilities\(sourceText\)/);
  assert.match(adapter, /sourceText = blocks\.map\(\(block\) => block\.text\)\.join/);
  assert.match(adapter, /bindIndicatorContext/);
  assert.match(adapter, /indicatorCode/);
  assert.match(adapter, /indicatorLabel/);
});

test("Universal V2 upgrades rich Lab structures instead of flattening them", () => {
  const packageV1 = {
    kind: "LAB",
    schemaVersion: "universal-lab-v1",
    runtimeProfile: "UNIVERSAL_V1",
    factoryCapabilities: inspectLabSourceCapabilities(riskSourceSignatures),
    investigations: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      prompts: [],
    })),
  };
  packageV1.investigations[3].prompts = [
    { id: "RSK.I4.R1", label: "Risk 1", prompt: "Name the risk", group: "Risk 1", required: true },
    { id: "RSK.I4.P1", label: "Risk 1 probability", prompt: "Probability (1–5)", group: "Risk 1", required: true },
    { id: "RSK.I4.M1", label: "Risk 1 magnitude", prompt: "Magnitude (1–5)", group: "Risk 1", required: true },
    { id: "RSK.I4.S1", label: "Risk 1 score", prompt: "Risk Score", group: "Risk 1", required: true },
  ];
  packageV1.investigations[6].prompts = Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    return [
      { id: `RSK.I7.D${day}.DATE`, label: `Day ${day} date`, prompt: "Date", group: `Day ${day}`, required: false },
      { id: `RSK.I7.D${day}.ACTION`, label: `Day ${day} action`, prompt: "Action I Took", group: `Day ${day}`, required: true },
      { id: `RSK.I7.D${day}.CHECK`, label: `Day ${day} action check`, prompt: "Did I take action?", group: `Day ${day}`, required: true },
      { id: `RSK.I7.D${day}.NOTES`, label: `Day ${day} notes`, prompt: "Notes", group: `Day ${day}`, required: false },
    ];
  }).flat();
  packageV1.investigations[6].prompts.push(
    { id: "RSK.I7.DAYS", label: "Days Completed", prompt: "Days Completed", group: "BEI-06", required: true },
    { id: "RSK.I7.ACTIONS", label: "Risk Actions Taken", prompt: "Risk Actions Taken", group: "BEI-06", required: true },
  );
  packageV1.investigations[8].prompts = [
    { id: "RSK.I9.PRIORITY", label: "My Priority Risk", prompt: "My Priority Risk", group: "Behaviour Profile Summary", required: false },
  ];
  packageV1.investigations[3].prompts.push(
    { id: "RSK.I4.PRIORITY", label: "My Priority Risk", prompt: "My Priority Risk", required: true },
  );

  const v2 = upgradeUniversalLabV2(packageV1);
  assert.equal(v2.schemaVersion, "universal-lab-v2");
  assert.equal(v2.runtimeProfile, "UNIVERSAL_V2");
  assert.equal(v2.experiment.days, 7);
  assert.equal(v2.investigations[6].prompts.find((item) => item.id === "RSK.I7.D7.CHECK").scheduleDay, 7);
  assert.equal(v2.investigations[3].prompts.find((item) => item.id === "RSK.I4.S1").readOnly, true);
  assert.equal(v2.investigations[8].prompts.find((item) => item.id === "RSK.I9.PRIORITY").readOnly, true);

  const computed = evaluateUniversalComputed(v2, {
    "RSK.I4.P1": 4,
    "RSK.I4.M1": 5,
    "RSK.I4.PRIORITY": "Account security",
    ...Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`RSK.I7.D${index + 1}.CHECK`, index < 5 ? "Yes" : "No"])),
  });
  assert.equal(computed["RSK.I4.S1"], 20);
  assert.equal(computed["RSK.I7.DAYS"], 7);
  assert.equal(computed["RSK.I7.ACTIONS"], 5);
  assert.equal(computed["RSK.I9.PRIORITY"], "Account security");
});

test("Universal V2 carries authored BEIs into a governed indicator registry", () => {
  const sourcePackage = {
    kind: "LAB",
    schemaVersion: "universal-lab-v1",
    runtimeProfile: "UNIVERSAL_V1",
    factoryCapabilities: {
      ...inspectLabSourceCapabilities(riskSourceSignatures),
      indicatorCodes: ["BEI-01", "BEI-02"],
      derivedSignatures: [],
      experiment: { detected: false, days: null },
      repeatableEvidenceTable: false,
      profileSummary: false,
      requiresBehaviourRuntimeV2: true,
    },
    investigations: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      prompts: [],
    })),
  };
  sourcePackage.investigations[0].prompts = [
    {
      id: "RSK.I1.AWARE",
      label: "BEI-01-Pre",
      prompt: "How aware are you of the risks in your life?",
      required: true,
      indicatorCode: "BEI-01",
      indicatorLabel: "Risk Awareness Index (Pre)",
    },
    {
      id: "RSK.I1.BASELINE.1",
      label: "I check what could go wrong",
      prompt: "I check what could go wrong",
      required: true,
      indicatorCode: "BEI-02",
      indicatorLabel: "Risk Baseline Profile",
    },
    {
      id: "RSK.I1.BASELINE.2",
      label: "I prepare before acting",
      prompt: "I prepare before acting",
      required: true,
      indicatorCode: "BEI-02",
      indicatorLabel: "Risk Baseline Profile",
    },
  ];

  const v2 = upgradeUniversalLabV2(sourcePackage);
  assert.deepEqual(v2.indicatorRegistry.map((entry) => entry.code), ["BEI-01", "BEI-02"]);
  assert.ok(v2.indicatorRegistry.every((entry) => entry.status === "BOUND"));
  assert.equal(v2.indicatorRegistry[0].primaryPromptId, "RSK.I1.AWARE");
  assert.equal(v2.indicatorRegistry[1].primaryPromptId, null);
  assert.deepEqual(v2.indicatorRegistry[1].promptIds, ["RSK.I1.BASELINE.1", "RSK.I1.BASELINE.2"]);
});

test("Universal V2 experiment timing follows real calendar days", () => {
  assert.equal(experimentCalendarDay("2026-10-01T10:00:00.000Z", "2026-10-01", 7), 1);
  assert.equal(experimentCalendarDay("2026-10-01T10:00:00.000Z", "2026-10-03", 7), 3);
  assert.equal(experimentCalendarDay("2026-10-01T10:00:00.000Z", "2026-10-20", 7), 8);
  assert.equal(experimentCalendarDay("2026-10-03T10:00:00.000Z", "2026-10-01", 7), 0);
});

test("compiler automatically selects Universal V2 for rich source capabilities", async () => {
  const compiler = await source("lib/content-compiler.ts");
  assert.match(compiler, /upgradeUniversalLabV2/);
  assert.match(compiler, /schemaVersion: v2 \? "universal-lab-v2" : "universal-lab-v1"/);
  assert.match(compiler, /Universal V2 requires a valid real-world experiment contract/);
  assert.match(compiler, /Behaviour Profile projection contract/);
  assert.match(compiler, /could not bind authored Behaviour Evidence Indicators to learner evidence fields/);
});
