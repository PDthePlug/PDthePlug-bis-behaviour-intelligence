import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectLabSourceCapabilities } from "../lib/lab-factory-capabilities.mjs";
import { applyHabitLabStandard } from "../lib/universal-lab-standard.mjs";
import { upgradeUniversalLabV2 } from "../lib/universal-lab-v2.mjs";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

const identitySourceSignatures = `
IDENTITY LAB™
Learner Workbook — Version 3.0 (System-Aligned, Universe-Ready)

IDENTITY BASELINE — PRE

BEI-01 Identity Clarity Index (Pre)
BEI-02 Identity Baseline Profile
BEI-03 Prediction Calibration Score
BEI-04 Identity Confidence Index (Pre)
BEI-05 Identity Risk Index
BEI-06 Experiment Adherence Rate
BEI-07 Identity Clarity Shift Index
BEI-08 Identity Confidence Index (Post)
BEI-09 Identity Shift Indicator
BEI-10 Behaviour Profile Summary

INVESTIGATION 7 — 7-DAY EXPERIMENT
Day
Date
Observation
Did I notice?
Notes
BEI-06: Days Completed: ___ / 7

INVESTIGATION 8 — EVIDENCE REVIEW
Shift: ___ points (BEI-07 - BEI-01)
Shift: ___ points (BEI-08 - BEI-04)

INVESTIGATION 9 — BEHAVIOUR PROFILE
BEHAVIOUR PROFILE SUMMARY

IDENTITY TRANSFORMATION CERTIFICATE
`;

function identityPackage() {
  const investigations = Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    title: [
      "The Hook",
      "The Prediction",
      "The Revelation",
      "Identity Mapping",
      "Identity Equation",
      "Identity Contract",
      "7-Day Experiment",
      "Evidence Review",
      "Behaviour Profile",
    ][index],
    mission: "Investigate identity with evidence.",
    phase: index === 6 ? "Experiment" : index === 7 ? "Review" : index === 8 ? "Synthesis" : "Investigation",
    time: "10 minutes",
    difficulty: "Observe",
    prompts: [],
    blocks: [],
  }));

  const add = (investigation, prompt) => {
    investigations[investigation - 1].prompts.push(prompt);
    investigations[investigation - 1].blocks.push({ type: "PROMPT", promptId: prompt.id });
  };

  add(1, {
    id: "IDN.I1.BECOMING",
    label: "The identity I am building",
    prompt: "If you had to describe who you are becoming in one sentence, what would it be?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  add(2, {
    id: "IDN.I2.BECOMING",
    label: "The identity I am building",
    prompt: "If you had to describe who you are becoming in one sentence, what would it be?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(2, {
    id: "IDN.I2.INFLUENCE",
    label: "Where my identity comes from",
    prompt: "Where did your current identity come from: family, friends, culture, experience, or something else?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(2, {
    id: "IDN.I2.INSIGHT",
    label: "Today's Insight",
    prompt: "Right now I feel like someone who...",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  add(3, {
    id: "IDN.I3.ASSUMPTION",
    label: "Assumption challenged",
    prompt: "What assumption did this story challenge?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  add(4, {
    id: "IDN.I4.GAP",
    label: "My identity gap",
    prompt: "Where is the gap between who you are and who you want to become?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(4, {
    id: "IDN.I4.COST",
    label: "The cost of not being myself",
    prompt: "What is the cost of being someone you are not, of pretending, hiding, or performing?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(4, {
    id: "IDN.I4.INSIGHT",
    label: "Today's Insight",
    prompt: "Right now I feel like someone who...",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  add(5, {
    id: "IDN.I5.EQUATION",
    label: "My equation",
    prompt: "Write the working equation that explains your identity pattern.",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(5, {
    id: "IDN.I5.CONFIDENCE",
    label: "Identity Confidence Index (Pre)",
    prompt: "How confident are you that this equation explains your identity pattern?",
    type: "INTEGER",
    min: 1,
    max: 10,
    required: true,
    indicatorCode: "BEI-04",
    indicatorLabel: "Identity Confidence Index (Pre)",
    origin: "SOURCE",
  });
  add(5, {
    id: "IDN.I5.FALSIFICATION",
    label: "Falsification test",
    prompt: "What evidence would prove your equation is wrong?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  add(6, {
    id: "IDN.I6.WITNESS",
    label: "My witness",
    prompt: "Who will hold me accountable?",
    type: "TEXT",
    required: false,
    origin: "SOURCE",
  });
  add(6, {
    id: "IDN.I6.RESTART",
    label: "My restart plan",
    prompt: "What will I do if I catch myself pretending?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(6, {
    id: "IDN.I6.FAILURE",
    label: "My failure signal",
    prompt: "How will I know if this experiment is not working?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  for (let day = 1; day <= 7; day += 1) {
    add(7, {
      id: `IDN.I7.DAY${day}.MOMENT`,
      label: "Moment I noticed",
      prompt: "What identity moment did you notice today?",
      type: "TEXT",
      required: true,
      group: `Day ${day}`,
      origin: "SOURCE",
    });
    add(7, {
      id: `IDN.I7.DAY${day}.NOTICED`,
      label: "Did I notice?",
      prompt: "Did you notice your identity in action?",
      type: "BOOLEAN",
      required: true,
      group: `Day ${day}`,
      origin: "SOURCE",
    });
  }

  add(8, {
    id: "IDN.I8.SUPPORT",
    label: "Evidence that convinced me",
    prompt: "What evidence convinced you that this pattern exists?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });
  add(8, {
    id: "IDN.I8.ASSUMPTION",
    label: "Belief that changed",
    prompt: "Which belief became harder to defend after this experiment?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  add(9, {
    id: "IDN.I9.SHIFT",
    label: "Identity Shift Indicator",
    prompt: "I am becoming someone who...",
    type: "TEXT",
    required: true,
    indicatorCode: "BEI-09",
    indicatorLabel: "Identity Shift Indicator",
    origin: "SOURCE",
  });
  add(9, {
    id: "IDN.I9.NEXT",
    label: "Next identity to investigate",
    prompt: "What identity or pattern do you want to investigate next?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  });

  return {
    kind: "LAB",
    schemaVersion: "universal-lab-v1",
    runtimeProfile: "UNIVERSAL_V1",
    identity: {
      code: "IDN",
      version: "1.0",
      title: "Identity Lab™",
      shortTitle: "Identity Lab",
      accent: "#2f8276",
    },
    factoryCapabilities: inspectLabSourceCapabilities(identitySourceSignatures),
    investigations,
  };
}

test("Identity Lab proves the shared factory can represent a second source-backed behavioural Lab", () => {
  const capabilities = inspectLabSourceCapabilities(identitySourceSignatures);

  assert.equal(capabilities.baseline, true);
  assert.equal(capabilities.indicatorCodes.length, 10);
  assert.equal(capabilities.experiment.detected, true);
  assert.equal(capabilities.experiment.days, 7);
  assert.equal(capabilities.repeatableEvidenceTable, true);
  assert.equal(capabilities.profileSummary, true);
  assert.equal(capabilities.certificate, true);
  assert.equal(capabilities.requiresBehaviourRuntimeV2, true);
});

test("Identity keeps the authored Pattern-stage evidence without replacing source repetition or reflection", () => {
  const result = applyHabitLabStandard(identityPackage());
  const pattern = result.investigations.find((item) => item.number === 2);

  assert.equal(pattern.standardStage.key, "PATTERN");
  for (const id of ["IDN.I2.BECOMING", "IDN.I2.INFLUENCE", "IDN.I2.INSIGHT"]) {
    assert.ok(pattern.prompts.some((prompt) => prompt.id === id), `${id} must remain source-authoritative`);
  }
  assert.equal(pattern.prompts.some((prompt) => prompt.standardPurpose === "PATTERN_TARGET"), false);
  assert.equal(pattern.prompts.some((prompt) => prompt.standardPurpose === "PATTERN_EVIDENCE"), false);
  assert.equal(result.normalizationNotes.some((note) =>
    note.sourcePromptId === "IDN.I2.BECOMING" || note.sourcePromptId === "IDN.I2.INSIGHT"
  ), false);
});

test("Identity receives the same Universal V2 calendar experiment contract as Risk without an IDN-specific engine branch", async () => {
  const prepared = applyHabitLabStandard(identityPackage());
  const upgraded = upgradeUniversalLabV2(prepared);
  const engine = await source("lib/universal-lab-v2.mjs");

  assert.equal(upgraded.runtimeProfile, "UNIVERSAL_V2");
  assert.equal(upgraded.experiment.investigation, 7);
  assert.equal(upgraded.experiment.days, 7);
  assert.equal(upgraded.experiment.scheduledPromptIds.length, 14);
  assert.deepEqual(
    [...new Set(upgraded.experiment.scheduledPromptIds.map((entry) => entry.day))],
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.doesNotMatch(engine, /\bIDN\b/);
});
