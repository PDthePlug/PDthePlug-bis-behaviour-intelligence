import assert from "node:assert/strict";
import test from "node:test";
import {
  HABIT_LAB_STANDARD_VERSION,
  HABIT_LAB_STAGES,
  applyHabitLabStandard,
  auditUniversalLabEditorialQuality,
} from "../lib/universal-lab-standard.mjs";

function baseLab() {
  return {
    kind: "LAB",
    identity: { code: "TST", title: "Test Lab", shortTitle: "Test Lab", version: "1.0" },
    investigations: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      title: [
        "Opening encounter",
        "My pattern",
        "The reveal",
        "Personal map",
        "Working model",
        "Field contract",
        "Live test",
        "Review",
        "My profile",
      ][index],
      mission: "Investigate with evidence.",
      phase: "Investigation",
      time: "10 minutes",
      difficulty: "Observe",
      prompts: [{
        id: `TST.I${index + 1}.GENERIC`,
        label: `Investigation ${index + 1} reflection`,
        prompt: `What evidence from Investigation ${index + 1} matters most to your investigation?`,
        type: "TEXT",
        required: true,
      }],
    })),
  };
}

test("Habit Lab standard keeps nine canonical stages while preserving authored Lab titles", () => {
  const result = applyHabitLabStandard(baseLab());
  assert.equal(result.standardVersion, HABIT_LAB_STANDARD_VERSION);
  assert.deepEqual(
    result.investigations.map((item) => item.standardStage?.key),
    HABIT_LAB_STAGES.map((stage) => stage.key),
  );
  assert.equal(result.investigations[1].title, "My pattern");
  assert.equal(result.investigations.length, 9);
});

test("Habit Lab standard adds missing evidence mechanics without pretending they came from the source", () => {
  const result = applyHabitLabStandard(baseLab());
  const purposes = result.investigations.flatMap((item) =>
    item.prompts.filter((prompt) => prompt.origin === "BIS_STANDARD").map((prompt) => prompt.standardPurpose),
  );
  for (const required of [
    "PREDICTION",
    "FALSIFICATION",
    "WITNESS",
    "MINIMUM_VERSION",
    "FAILURE_SIGNAL",
    "RESTART",
    "PREDICTED_ADHERENCE",
    "SUPPORTING_EVIDENCE",
    "CHALLENGING_EVIDENCE",
    "ASSUMPTION_REVISED",
    "TRANSFER",
    "OBSERVED",
    "CHANGED",
    "UNCERTAIN",
    "NEXT_TEST",
  ]) {
    assert.ok(purposes.includes(required), `missing standard purpose ${required}`);
  }
});

test("authored equivalents win over injected standard questions", () => {
  const source = baseLab();
  source.investigations[0].prompts.push({
    id: "TST.I1.AUTHORED.PREDICTION",
    label: "Prediction",
    prompt: "What do you predict will happen next?",
    type: "TEXT",
    required: true,
  });
  const result = applyHabitLabStandard(source);
  assert.equal(
    result.investigations[0].prompts.filter((prompt) => prompt.standardPurpose === "PREDICTION").length,
    0,
  );
  assert.ok(result.investigations[0].prompts.some((prompt) => prompt.id === "TST.I1.AUTHORED.PREDICTION"));
});

test("Investigation 8.5 transfer material is folded into Evidence Review rather than creating a tenth stage", () => {
  const source = baseLab();
  source.investigations.splice(8, 0, {
    number: 8.5,
    title: "Transfer Test",
    mission: "Try the principle somewhere else.",
    phase: "Transfer",
    time: "10 minutes",
    difficulty: "Challenge",
    prompts: [{
      id: "TST.I85.TRANSFER",
      label: "Transfer test",
      prompt: "Where else would this principle need to hold before you trust it?",
      type: "TEXT",
      required: true,
    }],
  });
  const result = applyHabitLabStandard(source);
  assert.equal(result.investigations.length, 9);
  assert.ok(result.investigations.find((item) => item.number === 8)?.prompts.some((prompt) => prompt.id === "TST.I85.TRANSFER"));
  assert.equal(result.investigations.some((item) => item.number === 8.5), false);
});

test("editorial audit surfaces generic low-information prompts instead of silently approving them", () => {
  const audit = auditUniversalLabEditorialQuality(baseLab());
  assert.equal(audit.status, "REVIEW");
  assert.ok(audit.issues.some((issue) => issue.code === "LOW_INFORMATION_PROMPT"));
});

test("missing canonical investigations block the Lab", () => {
  const source = baseLab();
  source.investigations = source.investigations.filter((item) => item.number !== 6);
  const audit = auditUniversalLabEditorialQuality(source);
  assert.equal(audit.status, "BLOCKED");
  assert.ok(audit.issues.some((issue) => issue.code === "MISSING_STAGE" && issue.investigation === 6));
});
