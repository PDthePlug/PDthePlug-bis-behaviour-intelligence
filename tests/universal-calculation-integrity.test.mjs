import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { prepareUniversalLabPresentation } from "../lib/universal-lab-presentation.mjs";
import { upgradeUniversalLabV2, evaluateUniversalComputed, validateUniversalCalculations } from "../lib/universal-lab-v2.mjs";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";

const corpus = { labs: [] };
const tools = await loadContentTools();
try {
  for (const volume of [1, 2, 3]) {
    const drafts = await tools.adaptBisVolumeSource(await readFile(new URL(`../content/sources/volume-${volume}.docx`, import.meta.url)), volume, "1.0");
    corpus.labs.push(...drafts.map((draft) => JSON.parse(new TextDecoder().decode(draft.packageBytes))));
  }
} finally { await tools.dispose(); }
const lab = (code) => prepareUniversalLabPresentation(upgradeUniversalLabV2(structuredClone(corpus.labs.find((item) => item.identity.code === code))));

test("five authored risks keep independent row inputs and scores", () => {
  const definition = lab("RSK");
  const products = definition.computedFields.filter((field) => field.operation === "PRODUCT");
  assert.equal(products.length, 5);
  assert.equal(new Set(products.map((field) => field.id)).size, 5);
  assert.equal(new Set(products.flatMap((field) => field.inputs)).size, 10);
  const values = Object.fromEntries(products.flatMap((field, index) => [[field.inputs[0], index + 1], [field.inputs[1], 5 - index]]));
  const scores = () => products.map((field) => evaluateUniversalComputed(definition, values)[field.id]);
  assert.deepEqual(scores(), [5, 8, 9, 8, 5]);
  values[products[0].id] = 999;
  assert.deepEqual(scores(), [5, 8, 9, 8, 5], "historical typed totals must not override a derived score");
  values[products[0].inputs[0]] = 2;
  assert.deepEqual(scores(), [10, 8, 9, 8, 5]);
});

test("control and confidence changes retain separate authored outputs", () => {
  const definition = lab("HAB");
  const shifts = definition.computedFields.filter((field) => field.operation === "DIFFERENCE");
  assert.equal(shifts.length, 2);
  const values = Object.fromEntries(shifts.flatMap((field, index) => [[field.inputs[0], index ? 5 : 9], [field.inputs[1], index ? 4 : 2]]));
  assert.deepEqual(shifts.map((field) => evaluateUniversalComputed(definition, values)[field.id]), [7, 1]);
  const pairs = definition.computedFields.filter((field) => field.operation === "PAIR");
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs.map((field) => evaluateUniversalComputed(definition, values)[field.id]).sort(), ["2 → 9", "4 → 5"]);
});

test("profile collections preserve order, missing slots and historical text without rewriting responses", () => {
  const definition = lab("TRU");
  const field = definition.computedFields.find((item) => item.label === "People I Trust");
  assert.equal(field.operation, "COLLECTION");
  assert.equal(field.inputs.length, 5);
  const values = { [field.inputs[0]]: "Demo mentor", [field.inputs[2]]: "Demo teammate" };
  const before = structuredClone(values);
  assert.equal(evaluateUniversalComputed(definition, values)[field.id], "1. Demo mentor\n2. —\n3. Demo teammate\n4. —\n5. —");
  assert.deepEqual(values, before);
  assert.equal(evaluateUniversalComputed(definition, { [field.legacyInputs[0]]: "Earlier authored list" })[field.id], "Earlier authored list");
  assert.equal(evaluateUniversalComputed(definition, {})[field.id], null);
});

test("the authored corpus has a valid final calculation graph and explicit small rating controls", () => {
  for (const raw of corpus.labs) {
    const definition = prepareUniversalLabPresentation(upgradeUniversalLabV2(structuredClone(raw)));
    validateUniversalCalculations(definition);
    const prompts = definition.investigations.flatMap((stage) => stage.prompts);
    for (const prompt of prompts.filter((item) => item.type === "INTEGER" && /scale of 1|(?:probability|magnitude).*1[–-]5/i.test(item.prompt))) {
      assert.equal(prompt.controlRole, "RATING", prompt.id);
    }
  }
});

test("invalid calculation graphs fail before publication", () => {
  const base = { investigations: [{ prompts: [{ id: "output" }, { id: "input" }] }] };
  for (const fields of [
    [{ id: "output", operation: "COPY", inputs: [] }],
    [{ id: "output", operation: "DIFFERENCE", inputs: ["input"] }],
    [{ id: "output", operation: "COPY", inputs: ["missing"] }],
    [{ id: "output", operation: "COPY", inputs: ["output"] }],
    [{ id: "output", operation: "COPY", inputs: ["input"] }, { id: "output", operation: "COPY", inputs: ["input"] }],
  ]) assert.throws(() => validateUniversalCalculations({ ...base, computedFields: fields }));
});
