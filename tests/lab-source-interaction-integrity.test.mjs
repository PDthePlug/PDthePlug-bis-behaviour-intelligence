import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";
import { auditDefinition } from "../scripts/audit-lab-interactions.mjs";
import { prepareUniversalLabPresentation } from "../lib/universal-lab-presentation.mjs";
import { upgradeUniversalLabV2, experimentCalendarDay, universalExperimentEvidenceProgress } from "../lib/universal-lab-v2.mjs";
import { availableLabPrompts, validateLabSubmission } from "../lib/lab-interaction-contract.mjs";

const fixture = JSON.parse(await readFile(new URL("fixtures/authored-lab-interactions.json", import.meta.url), "utf8"));
const authored = (code) => fixture.labs.find((lab) => lab.identity.code === code);
const definition = (code) => prepareUniversalLabPresentation(upgradeUniversalLabV2(authored(code)));

test("real Leadership source survives the actual compiler and all evidence windows", async () => {
  const tools = await loadContentTools();
  try {
    const raw = authored("LDR");
    const artifact = await tools.compileUniversalLab(new TextEncoder().encode(JSON.stringify(raw)), "LDR", "1.0");
    const result = prepareUniversalLabPresentation(JSON.parse(artifact.content));
    const summary = auditDefinition(raw, result);
    assert.equal(summary.baselineItems, 10);
    assert.equal(availableLabPrompts(result, 0).length, 11);
    assert.equal(result.investigations[0].prompts.some((prompt) => prompt.group === "Baseline"), false);
    const review = result.investigations[7];
    for (const question of [
      "Did I lead intentionally most days? Why or why not?",
      "What was the hardest part of the 7 days?",
      "When did you feel most like a leader—and when did you feel least?",
      "What surprised you most about leadership in your life?",
      "What evidence convinced you that this pattern exists?",
      "Which belief became harder to defend after this experiment?",
    ]) assert.equal(review.prompts.filter((prompt) => prompt.prompt === question).length, 1, question);
    assert.equal(result.investigations[4].prompts.some((prompt) => prompt.standardPurpose === "FALSIFICATION"), false);
  } finally { await tools.dispose(); }
});

test("published Growth Mindset and Systems packages preserve distinct source responses", () => {
  for (const code of ["GMN", "SYS"]) auditDefinition(authored(code), definition(code));
});

test("commitment sentence and signature/date remain compact inline controls on re-normalization", () => {
  const result = definition("LDR");
  const contract = result.investigations[5];
  const sentence = contract.blocks.find((block) => block.type === "INLINE" && block.segments.some((segment) => segment.kind === "TEXT" && segment.text.includes("commit to")));
  assert.ok(sentence);
  const prompts = sentence.segments.filter((segment) => segment.kind === "PROMPT").map((segment) => contract.prompts.find((prompt) => prompt.id === segment.promptId));
  assert.deepEqual(prompts.map((prompt) => prompt.type), ["TEXT", "DATE", "DATE"]);
  for (const label of ["Signed", "Date", "My leadership promise — I will"]) {
    const prompt = contract.prompts.find((item) => item.label === label);
    assert.ok(contract.blocks.some((block) => block.type === "INLINE" && block.segments.some((segment) => segment.promptId === prompt.id)), label);
  }
  const previous = { ...result, presentationVersion: "bis-lab-presentation-3" };
  const repaired = prepareUniversalLabPresentation(previous);
  for (const prompt of prompts) assert.ok(repaired.investigations[5].prompts.some((item) => item.id === prompt.id));
});

test("real Day 1 answers and passes save without phantom requirements; future/past fields are refused", () => {
  const result = definition("LDR");
  const fields = availableLabPrompts(result, 7, 1).filter((prompt) => !prompt.readOnly);
  assert.equal(fields.length, 4);
  const action = fields.find((prompt) => prompt.type === "BOOLEAN");
  assert.ok(action);
  const submitted = fields.map((prompt) => ({
    semanticFieldId: prompt.id,
    value: prompt.type === "DATE" ? "03/10/2026" : prompt.type === "BOOLEAN" ? "No i did not" : "I noticed the opportunity.",
  }));
  const saved = validateLabSubmission(result, 7, 1, submitted);
  assert.equal(saved.find((item) => item.prompt.type === "BOOLEAN").value, "No");
  const responses = Object.fromEntries(saved.map((item) => [item.semanticFieldId, { value: item.value, status: item.responseStatus }]));
  assert.equal(universalExperimentEvidenceProgress(result, responses, 1).todayEvidenceRecorded, true);
  assert.equal(universalExperimentEvidenceProgress(result, responses, 2).todayEvidenceRecorded, false);
  const passed = validateLabSubmission(result, 7, 1, fields.map((prompt) => ({ semanticFieldId: prompt.id, responseStatus: "PASS" })));
  assert.equal(passed.length, 4);
  assert.throws(() => validateLabSubmission(result, 7, 2, submitted), /outside the current activity/);
  assert.throws(() => validateLabSubmission(result, 7, 8, submitted), /outside the current activity/);
  assert.throws(() => validateLabSubmission(result, 7, 1, [], { [action.id]: { status: "ANSWERED", value: "" } }), /Complete or pass:/);
});

test("experiment starts on the learner's local calendar and closes after its authored duration", () => {
  assert.equal(experimentCalendarDay("2026-10-02T22:30:00.000Z", "2026-10-03", 7), 1);
  assert.equal(experimentCalendarDay("2026-10-02T22:30:00.000Z", "2026-10-04", 7), 2);
  assert.equal(experimentCalendarDay("2026-10-02T22:30:00.000Z", "2026-10-10", 7), 8);
  assert.equal(availableLabPrompts(definition("LDR"), 7, 8).some((prompt) => !prompt.readOnly), false);
});

test("digital baselines compile without requiring facilitator scoring", async () => {
  const tools = await loadContentTools();
  try {
    for (const code of ["GMN", "SYS"]) {
      const artifact = await tools.compileUniversalLab(new TextEncoder().encode(JSON.stringify(authored(code))), code, "1.0");
      const result = prepareUniversalLabPresentation(JSON.parse(artifact.content));
      assert.equal(result.presentationBaseline.items.length, 10);
      if (code === "SYS") {
        assert.equal(result.indicatorRegistry.find((item) => item.code === "TEI-09").status, "NOT_COLLECTED");
        assert.equal(result.investigations[7].prompts.some((prompt) => /^Score \(1[–-]5\)/i.test(prompt.prompt)), false);
        assert.ok(result.investigations[7].prompts.some((prompt) => /What the system is/i.test(prompt.prompt)));
      }
      auditDefinition(authored(code), result);
    }
  } finally { await tools.dispose(); }
});

test("Launch preserves four weekly evidence windows across the authored thirty days", () => {
  const result = definition("LCH");
  auditDefinition(authored("LCH"), result);
  assert.equal(result.experiment.days, 30);
  assert.equal(result.experiment.cadence, "WEEKLY");
  const ids = (day) => availableLabPrompts(result, 7, day).filter((prompt) => !prompt.readOnly).map((prompt) => prompt.id);
  assert.deepEqual(ids(1), ids(7));
  assert.notDeepEqual(ids(7), ids(8));
  assert.deepEqual(ids(22), ids(30));
  assert.deepEqual(ids(31), []);
  const weekOne = availableLabPrompts(result, 7, 1).filter((prompt) => !prompt.readOnly);
  const passed = validateLabSubmission(result, 7, 7, weekOne.map((prompt) => ({ semanticFieldId: prompt.id, responseStatus: "PASS" })));
  const responses = Object.fromEntries(passed.map((item) => [item.semanticFieldId, { status: item.responseStatus, value: item.value }]));
  assert.equal(universalExperimentEvidenceProgress(result, responses, 7).todayEvidenceRecorded, true);
  assert.equal(universalExperimentEvidenceProgress(result, responses, 8).todayEvidenceRecorded, false);
  assert.throws(() => validateLabSubmission(result, 7, 8, weekOne.map((prompt) => ({ semanticFieldId: prompt.id, responseStatus: "PASS" }))), /outside the current activity/);
});
