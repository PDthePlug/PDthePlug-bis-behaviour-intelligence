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
    "PATTERN_TARGET",
    "PATTERN_EVIDENCE",
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


test("Investigation 2 receives a pattern target and recent evidence anchor when the source only predicts", () => {
  const source = baseLab();
  source.investigations[1].title = "The Prediction";
  source.investigations[1].prompts = [{
    id: "TST.I2.PREDICT",
    label: "Your prediction",
    prompt: "If you tracked this for one day, where do you think most of it would go?",
    type: "TEXT",
    required: true,
  }];

  const result = applyHabitLabStandard(source);
  const purposes = result.investigations[1].prompts
    .filter((prompt) => prompt.origin === "BIS_STANDARD")
    .map((prompt) => prompt.standardPurpose);
  assert.ok(purposes.includes("PATTERN_TARGET"));
  assert.ok(purposes.includes("PATTERN_EVIDENCE"));
  assert.equal(result.investigations[1].standardStage?.key, "PATTERN");
});



test("a rich authored Pattern stage is not padded with generic Pattern target and recent-example questions", () => {
  const source = baseLab();
  source.investigations[1].prompts = [
    {
      id: "TST.I2.BELIEF",
      label: "What I believe",
      prompt: "What is one thing you believe you are not good at, and where did that belief come from?",
      type: "TEXT",
      required: true,
    },
    {
      id: "TST.I2.SAID",
      label: "What I said",
      prompt: "What did you actually say in the recent moment?",
      type: "TEXT",
      required: true,
    },
    {
      id: "TST.I2.NEXT",
      label: "What happened next",
      prompt: "What happened next?",
      type: "TEXT",
      required: true,
    },
    {
      id: "TST.I2.NOTICE",
      label: "Notice the pattern",
      prompt: "Do you believe you could get better at it—or is it fixed?",
      type: "TEXT",
      required: true,
    },
  ];

  const result = applyHabitLabStandard(source);
  const injected = result.investigations[1].prompts.filter((prompt) =>
    ["PATTERN_TARGET", "PATTERN_EVIDENCE"].includes(prompt.standardPurpose),
  );
  assert.equal(injected.length, 0);
  for (const id of ["TST.I2.BELIEF", "TST.I2.SAID", "TST.I2.NEXT", "TST.I2.NOTICE"]) {
    assert.ok(result.investigations[1].prompts.some((prompt) => prompt.id === id));
  }
});

test("authored falsification wording prevents a duplicate generic falsification task", () => {
  const source = baseLab();
  source.investigations[4].prompts.push({
    id: "TST.I5.FALSIFY",
    label: "What evidence would prove your equation is wrong?",
    prompt: "What evidence would prove your equation is wrong?",
    type: "TEXT",
    required: true,
  });
  const result = applyHabitLabStandard(source);
  assert.equal(
    result.investigations[4].prompts.some((prompt) => prompt.standardPurpose === "FALSIFICATION"),
    false,
  );
  assert.ok(result.investigations[4].prompts.some((prompt) => prompt.id === "TST.I5.FALSIFY"));
});

test("authored cross-stage repeats are preserved because source repetition can be intentional", () => {
  const source = baseLab();
  source.investigations[0].prompts.push({
    id: "TST.I1.IDENTITY",
    label: "The identity I am building",
    prompt: "If you had to describe who you are becoming in one sentence, what would it be?",
    type: "TEXT",
    required: true,
  });
  source.investigations[1].prompts.push({
    id: "TST.I2.IDENTITY",
    label: "The identity I am building",
    prompt: "If you had to describe who you are becoming in one sentence, what would it be?",
    type: "TEXT",
    required: true,
  });

  const result = applyHabitLabStandard(source);

  assert.ok(result.investigations[0].prompts.some((prompt) => prompt.id === "TST.I1.IDENTITY"));
  assert.ok(result.investigations[1].prompts.some((prompt) => prompt.id === "TST.I2.IDENTITY"));
  assert.equal(result.normalizationNotes.some((note) =>
    note.code === "DUPLICATE_PROMPT_SUPPRESSED"
    && note.sourcePromptId === "TST.I2.IDENTITY"
  ), false);
});

test("repeated daily experiment prompts are preserved because each calendar day is distinct evidence", () => {
  const source = baseLab();
  source.investigations[6].prompts = [
    {
      id: "TST.I7.DAY1",
      label: "What happened?",
      prompt: "What happened in the matching situation today?",
      type: "TEXT",
      required: true,
      group: "Day 1",
      scheduleDay: 1,
    },
    {
      id: "TST.I7.DAY2",
      label: "What happened?",
      prompt: "What happened in the matching situation today?",
      type: "TEXT",
      required: true,
      group: "Day 2",
      scheduleDay: 2,
    },
  ];

  const result = applyHabitLabStandard(source);
  const experimentIds = result.investigations[6].prompts.map((prompt) => prompt.id);

  assert.ok(experimentIds.includes("TST.I7.DAY1"));
  assert.ok(experimentIds.includes("TST.I7.DAY2"));
  assert.equal(
    result.normalizationNotes.some((note) =>
      note.code === "DUPLICATE_PROMPT_SUPPRESSED"
      && ["TST.I7.DAY1", "TST.I7.DAY2"].includes(note.sourcePromptId)
    ),
    false,
  );
});

test("authored duplicate prompt blocks remain bound to their own source-stage controls", () => {
  const source = baseLab();
  source.investigations[0].prompts.push({
    id: "TST.I1.REPEAT",
    label: "Current reflection",
    prompt: "Right now I feel like someone who...",
    type: "TEXT",
    required: true,
  });
  source.investigations[1].prompts.push({
    id: "TST.I2.REPEAT",
    label: "Current reflection",
    prompt: "Right now I feel like someone who...",
    type: "TEXT",
    required: true,
  });
  source.investigations[1].blocks = [
    { type: "PROMPT", promptId: "TST.I2.REPEAT" },
    { type: "HTML", html: "<p>Keep this authored explanation.</p>" },
  ];

  const result = applyHabitLabStandard(source);

  assert.ok(result.investigations[1].prompts.some((prompt) => prompt.id === "TST.I2.REPEAT"));
  assert.ok(result.investigations[1].blocks.some((block) => block.promptId === "TST.I2.REPEAT"));
  assert.ok(result.investigations[1].blocks.some((block) => block.type === "HTML"));
});


test("authored reflection prompts remain controls even when stronger evidence tasks share the stage", () => {
  const source = baseLab();
  source.investigations[3].prompts = [
    {
      id: "TST.I4.MAP",
      label: "Pattern map",
      prompt: "Map the specific people, places and conditions that shape this pattern.",
      type: "TEXT",
      required: true,
      origin: "SOURCE",
    },
    {
      id: "TST.I4.INSIGHT",
      label: "Today's Insight",
      prompt: "Right now I feel like someone who...",
      type: "TEXT",
      required: true,
      origin: "SOURCE",
    },
  ];
  source.investigations[3].blocks = [
    { type: "PROMPT", promptId: "TST.I4.MAP" },
    { type: "PROMPT", promptId: "TST.I4.INSIGHT" },
  ];

  const result = applyHabitLabStandard(source);

  assert.ok(result.investigations[3].prompts.some((prompt) => prompt.id === "TST.I4.MAP"));
  assert.ok(result.investigations[3].prompts.some((prompt) => prompt.id === "TST.I4.INSIGHT"));
  assert.ok(result.investigations[3].blocks.some((block) => block.promptId === "TST.I4.INSIGHT"));
  assert.equal(result.normalizationNotes.some((note) =>
    note.code === "LOW_INFORMATION_PROMPT_SUPPRESSED"
    && note.sourcePromptId === "TST.I4.INSIGHT"
  ), false);
});

test("a broad prompt is retained when it is the only learner task instead of creating an empty investigation", () => {
  const source = baseLab();
  source.investigations[3].prompts = [{
    id: "TST.I4.ONLY",
    label: "Reflection",
    prompt: "What did you learn?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  }];

  const result = applyHabitLabStandard(source);
  assert.ok(result.investigations[3].prompts.some((prompt) => prompt.id === "TST.I4.ONLY"));
});

test("table-bound prompts are never removed by cross-stage deduplication", () => {
  const source = baseLab();
  const repeated = "What happened in this specific situation?";
  source.investigations[0].prompts.push({
    id: "TST.I1.EVENT",
    label: "Event",
    prompt: repeated,
    type: "TEXT",
    required: true,
  });
  source.investigations[3].prompts.push({
    id: "TST.I4.EVENT",
    label: "Event",
    prompt: repeated,
    type: "TEXT",
    required: true,
  });
  source.investigations[3].blocks = [{
    type: "TABLE",
    rows: [[{ kind: "PROMPT", promptId: "TST.I4.EVENT" }]],
  }];

  const result = applyHabitLabStandard(source);
  assert.ok(result.investigations[3].prompts.some((prompt) => prompt.id === "TST.I4.EVENT"));
});
