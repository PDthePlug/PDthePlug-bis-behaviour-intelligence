import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

function serializedTable(cells) {
  return cells.map((cell) => [
    "|      |",
    "| ---- |",
    "",
    cell,
    "",
  ].join("\n")).join("\n");
}

function simpleInvestigation(number, title) {
  return [
    "### INVESTIGATION " + number + " — " + title,
    "",
    "**MISSION:** *Investigate the evidence.*",
    "",
    "What did you notice?",
    "",
    "________________________",
    "",
  ].join("\n");
}

function riskFactoryMarkdown() {
  const riskMap = serializedTable([
    "**Risk**",
    "**Probability (1–5)**",
    "**Magnitude (1–5)**",
    "**Risk Score (P × M)**",
    "1.",
    "",
    "",
    "",
    "2.",
    "",
    "",
    "",
  ]);

  const experiment = serializedTable([
    "**Day**",
    "**Date**",
    "**Action I Took**",
    "**Did I take action?**",
    "**Notes**",
    "1",
    "",
    "",
    "☐ Yes ☐ No",
    "",
    "2",
    "",
    "",
    "☐ Yes ☐ No",
    "",
  ]);

  const profile = serializedTable([
    "**Element**",
    "**Your Answer**",
    "**My Priority Risk**",
    "",
    "**Risk Score (P × M)**",
    "",
  ]);

  return [
    "# RISK LAB™",
    "",
    "BEI-01 Risk Awareness Index (Pre)",
    "BEI-02 Risk Baseline Profile",
    "BEI-03 Prediction Calibration Score",
    "BEI-04 Risk Confidence Index (Pre)",
    "BEI-05 Risk Index",
    "BEI-06 Experiment Adherence Rate",
    "BEI-07 Risk Awareness Shift Index",
    "BEI-08 Risk Confidence Index (Post)",
    "BEI-09 Identity Shift Indicator",
    "BEI-10 Behaviour Profile Summary",
    "",
    simpleInvestigation(1, "THE HOOK"),
    simpleInvestigation(2, "RISK BASELINE"),
    "### INVESTIGATION 3 — PREDICTION",
    "",
    "**MISSION:** *Calibrate the prediction.*",
    "",
    "**BEI-03: Prediction Calibration Score:** ☐ Correct ☐ Incorrect",
    "",
    "### INVESTIGATION 4 — RISK MAPPING",
    "",
    "**MISSION:** *Map the risks.*",
    "",
    "Probability × Magnitude = Risk Score",
    "",
    riskMap,
    "",
    simpleInvestigation(5, "RISK EQUATION"),
    "### INVESTIGATION 6 — RISK CONTRACT",
    "",
    "**MISSION:** *Commit to an action.*",
    "",
    "**BEI-05: Risk Index**",
    "",
    "**My biggest risk affects:**",
    "",
    "☐ My finances",
    "",
    "☐ My health",
    "",
    "☐ My future",
    "",
    "### INVESTIGATION 7 — 7-DAY EXPERIMENT",
    "",
    "**MISSION:** *Track your actions for seven days.*",
    "",
    experiment,
    "",
    "BEI-06: Days Completed: ___ / 7",
    "Risk Actions Taken: ___ / 7",
    "",
    simpleInvestigation(8, "EVIDENCE REVIEW"),
    "Shift: ___ points (BEI-07 - BEI-01)",
    "Shift: ___ points (BEI-08 - BEI-04)",
    "",
    "### INVESTIGATION 9 — BEHAVIOUR PROFILE",
    "",
    "**MISSION:** *Build the profile.*",
    "",
    "### BEHAVIOUR PROFILE SUMMARY",
    "",
    profile,
    "",
    "________________________",
  ].join("\n");
}

test("Markdown Lab imports reconstruct serialized authored tables before manufacturing prompts", async () => {
  const tsSource = await source("lib/content-source-adapters.ts");
  const compiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
  }).outputText;

  const temp = await mkdtemp(join(tmpdir(), "bis-markdown-lab-table-"));
  try {
    const adapterPath = join(temp, "content-source-adapters.mjs");
    const capabilitiesPath = join(temp, "lab-factory-capabilities.mjs");
    await writeFile(adapterPath, compiled, "utf8");
    await writeFile(join(temp, "docx-table.mjs"), await source("lib/docx-table.mjs"), "utf8");
    await writeFile(capabilitiesPath, await source("lib/lab-factory-capabilities.mjs"), "utf8");

    const adapter = await import(pathToFileURL(adapterPath).href + "?v=" + Date.now());
    const bytes = new TextEncoder().encode(riskFactoryMarkdown());
    const adapted = await adapter.adaptLabSource(
      bytes,
      "MARKDOWN",
      "RSK",
      "3.0",
      { title: "Risk Lab™", slug: "risk" },
    );
    const lab = JSON.parse(new TextDecoder().decode(adapted));

    assert.equal(lab.investigations.length, 9);
    assert.equal(lab.investigations[0].mission, "Investigate the evidence.");
    assert.ok(lab.investigations.every((investigation) => !investigation.mission.includes("*")));

    const calibration = lab.investigations[2].prompts;
    assert.equal(calibration.length, 1);
    assert.equal(calibration[0].type, "CATEGORICAL");
    assert.deepEqual(calibration[0].options, ["Correct", "Incorrect"]);
    assert.equal(calibration[0].indicatorCode, "BEI-03");

    const riskIndex = lab.investigations[5].prompts;
    assert.equal(riskIndex.length, 1);
    assert.equal(riskIndex[0].type, "MULTI_SELECT");
    assert.deepEqual(riskIndex[0].options, ["My finances", "My health", "My future"]);
    assert.equal(riskIndex[0].indicatorCode, "BEI-05");

    const mapping = lab.investigations[3].prompts;
    assert.equal(mapping.length, 8);
    assert.equal(mapping.filter((prompt) => /probability/i.test(prompt.label)).length, 2);
    assert.equal(mapping.filter((prompt) => /magnitude/i.test(prompt.label)).length, 2);
    assert.equal(mapping.filter((prompt) => /score/i.test(prompt.label)).length, 2);
    assert.ok(mapping.filter((prompt) => /probability|magnitude/i.test(prompt.label)).every((prompt) => prompt.type === "INTEGER"));

    const tracking = lab.investigations[6].prompts;
    assert.equal(tracking.filter((prompt) => /^Day [12] action$/.test(prompt.label)).length, 2);
    assert.equal(tracking.filter((prompt) => /action check/.test(prompt.label)).length, 2);
    assert.ok(tracking.some((prompt) => prompt.type === "BOOLEAN"));

    const profilePrompts = lab.investigations[8].prompts.filter((prompt) => prompt.group === "Behaviour Profile Summary");
    assert.deepEqual(profilePrompts.map((prompt) => prompt.label), ["My Priority Risk", "Risk Score (P × M)"]);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});


test("Leadership-style daily trackers are manufactured as calendar-ready evidence prompts", async () => {
  const tsSource = await source("lib/content-source-adapters.ts");
  const compiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
  }).outputText;

  const temp = await mkdtemp(join(tmpdir(), "bis-leadership-tracker-"));
  try {
    const adapterPath = join(temp, "content-source-adapters.mjs");
    const capabilitiesPath = join(temp, "lab-factory-capabilities.mjs");
    await writeFile(adapterPath, compiled, "utf8");
    await writeFile(join(temp, "docx-table.mjs"), await source("lib/docx-table.mjs"), "utf8");
    await writeFile(capabilitiesPath, await source("lib/lab-factory-capabilities.mjs"), "utf8");

    const adapter = await import(pathToFileURL(adapterPath).href + "?v=" + Date.now());
    const markdown = riskFactoryMarkdown()
      .replace("**Action I Took**", "**Moment I Noticed**")
      .replace("**Did I take action?**", "**Did I act?**");
    const adapted = await adapter.adaptLabSource(
      new TextEncoder().encode(markdown),
      "MARKDOWN",
      "LDR",
      "3.0",
      { title: "Leadership Lab™", slug: "leadership" },
    );
    const lab = JSON.parse(new TextDecoder().decode(adapted));
    const tracking = lab.investigations[6].prompts;

    assert.equal(tracking.filter((prompt) => prompt.group === "Day 1").length, 4);
    assert.equal(tracking.filter((prompt) => prompt.group === "Day 2").length, 4);
    assert.ok(tracking.some((prompt) => prompt.label === "Day 1 evidence" && /Moment I Noticed/.test(prompt.prompt)));
    assert.ok(tracking.some((prompt) => prompt.label === "Day 1 action check" && prompt.type === "BOOLEAN"));
    assert.ok(tracking.some((prompt) => prompt.label === "Day 1 notes" && prompt.required === false));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
