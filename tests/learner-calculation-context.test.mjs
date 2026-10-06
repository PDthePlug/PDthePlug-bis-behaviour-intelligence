import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { learnerCalculationContexts } from "../lib/learner-calculation-context.mjs";
import { evaluateUniversalComputed, upgradeUniversalLabV2 } from "../lib/universal-lab-v2.mjs";
import { prepareUniversalLabPresentation } from "../lib/universal-lab-presentation.mjs";

const fixture = { investigations: [{ number: 1, prompts: [
  { id: "pre", label: "Starting control", controlRole: "RATING", min: 1, max: 10 },
  { id: "post", label: "Later control", controlRole: "RATING", min: 1, max: 10 },
  { id: "shift", label: "Shift" },
] }], computedFields: [{ id: "shift", operation: "DIFFERENCE", inputs: ["post", "pre"] }] };

test("rating context retains subtraction order and explains zero and negative points without competence claims", () => {
  const original = JSON.stringify(fixture);
  const [context] = learnerCalculationContexts(fixture);
  assert.equal(context.calculation, "Later control minus Starting control.");
  assert.match(context.meaning, /points on the original 1–10 rating scale/);
  assert.match(context.meaning, /zero means the ratings are equal/);
  assert.match(context.meaning, /not an assessment of skill/);
  assert.equal(evaluateUniversalComputed(fixture, { pre: 7, post: 7 }).shift, 0);
  assert.equal(evaluateUniversalComputed(fixture, { pre: 7, post: 5 }).shift, -2);
  assert.equal(evaluateUniversalComputed(fixture, { pre: 7 }).shift, null);
  assert.equal(JSON.stringify(fixture), original);
});

test("record counts and affirmative counts describe different evidence; unknown scales do not acquire units", () => {
  const definition = { computedFields: [
    { id: "coverage", operation: "COUNT_PRESENT", inputs: ["a", "b"] },
    { id: "action", operation: "COUNT_TRUE", inputs: ["a", "b"] },
    { id: "unknown-scale", operation: "DIFFERENCE", inputs: ["a", "b"] },
  ] };
  const contexts = learnerCalculationContexts(definition);
  assert.match(contexts[0].meaning, /not a success rate/);
  assert.match(contexts[1].meaning, /do not count as affirmative/);
  assert.doesNotMatch(contexts[2].meaning, /undefined|rating scale/);
  const values = evaluateUniversalComputed(definition, { a: "No", b: "No opportunity" });
  assert.equal(values.coverage, 2); assert.equal(values.action, 0);
  assert.equal(evaluateUniversalComputed(definition, {}).coverage, null);
});

test("every computed field in accepted Lab interaction fixtures gets source context without changing the package", async () => {
  const fixtures = JSON.parse(await readFile(new URL("fixtures/authored-lab-interactions.json", import.meta.url), "utf8"));
  for (const source of fixtures.labs) {
    const definition = prepareUniversalLabPresentation(upgradeUniversalLabV2(source));
    const original = JSON.stringify(definition);
    const contexts = learnerCalculationContexts(definition);
    assert.deepEqual(contexts.map(context => context.id), definition.computedFields.map(field => field.id));
    for (const context of contexts) {
      const field = definition.computedFields.find(field => field.id === context.id);
      assert.deepEqual(context.sources.map(input => input.id), field.inputs);
      assert.doesNotMatch(JSON.stringify(context.sources.map(input => input.label)), /\b(?:BEI|TEI)-\d/);
      assert.ok(context.calculation && context.meaning);
    }
    assert.equal(JSON.stringify(definition), original);
  }
});
