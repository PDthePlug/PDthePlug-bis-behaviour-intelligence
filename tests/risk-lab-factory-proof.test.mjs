import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectLabSourceCapabilities, capabilitySummary } from "../lib/lab-factory-capabilities.mjs";

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
});

test("Universal V1 fails closed when a Lab needs richer behaviour runtime semantics", async () => {
  const compiler = await source("lib/content-compiler.ts");

  assert.match(compiler, /requiresBehaviourRuntimeV2/);
  assert.match(compiler, /Universal Lab V1 cannot preserve its full behavioural architecture/);
  assert.match(compiler, /Activation is blocked rather than flattening the Lab into generic prompts/);
  assert.match(compiler, /Complete the Universal Lab V2 runtime contract first/);
});
