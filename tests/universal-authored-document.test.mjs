import test from "node:test";
import assert from "node:assert/strict";
import { compileUniversalAuthoredDocument } from "../lib/universal-authored-document.mjs";
import { sanitizeRuntimePackage } from "../lib/content-html.mjs";
import { loadPreparedLearningSource } from "../lib/prepared-learning-source.mjs";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";

const tools = await loadContentTools();
test.after(() => tools.dispose());

test("the actual Habit manuscript retains its tasks without the screenshot's phantom questions or paper lines", async () => {
  const source = await loadPreparedLearningSource("HAB", "school");
  const programme = JSON.parse((await tools.compileLearningEdition(source.bytes, "HAB", source.sourceVersion, "school")).content);
  const page = programme.treatment.pages.find(page => page.key === "Day 1");
  assert.match(page.document.html, /Why does this happen\?/);
  assert.ok(!page.document.fields.some(field => /Why does this happen|is it a repeated behaviour that serves me/i.test(field.label)));
  for (const word of ["serves", "costs"]) assert.equal(page.document.fields.filter(field => field.label === `Write one repeated behaviour that ${word} you.`).length, 1);
  assert.doesNotMatch(page.document.html, /_{4,}/);
  const instruction = "Tick the one that is a repeated behaviour, not a label.";
  assert.equal(page.document.html.split(instruction).length - 1, 1);
  const question = "Why does your brain turn decisions into patterns?";
  assert.equal(page.document.fields.filter(field => field.label.endsWith(question)).length, 1, "The genuine authored Quick Check remains answerable.");
  assert.equal(page.document.html.split(question).length - 1, 1, "The real question is printed once, rather than repeated in a generated heading.");
  assert.match(page.document.html, /<details class="checkpoint-answer-panel"><summary>Answers:/);
});

test("declarative source controls retain private semantic IDs and decoded choices in their original table cells", () => {
  const document = compileUniversalAuthoredDocument('<p>Why does this happen?</p><table><tr><td>One</td><td><select data-field-id="HAB.WB.SCHOOL.TEST" data-source-key="source-cell" aria-label="A &amp; B"><option value="">Choose</option><option value="A &amp; B">A &amp; B</option><option value="Neither">Neither</option></select></td></tr></table>');
  assert.equal(document.fields.length, 1);
  assert.equal(document.fields[0].id, "HAB.WB.SCHOOL.TEST");
  assert.equal(document.fields[0].privacyClass, "P3");
  assert.equal(document.fields[0].label, "A & B");
  assert.deepEqual(document.fields[0].options, ["A & B", "Neither"]);
  assert.match(document.html, /<td><span[^>]+data-universal-response-slot="HAB.WB.SCHOOL.TEST"/);
  assert.match(document.html, /handbook-table-scroll/);
});

test("unbound, duplicated and forged response locations fail preparation", () => {
  assert.throws(() => compileUniversalAuthoredDocument('<input aria-label="Answer" />'), /stable ID/);
  const field = '<textarea data-field-id="HAB.WB.SCHOOL.TEST" data-source-key="source" aria-label="Answer"></textarea>';
  assert.throws(() => compileUniversalAuthoredDocument(field + field), /Duplicate/);
  assert.throws(() => compileUniversalAuthoredDocument('<span data-universal-response-slot="forged"></span>'), /reserved/);
});

test("delivery sanitizes the shared document alongside the retained source HTML", () => {
  const payload = { treatment: { pages: [{ html: '<p>Source</p>', document: { html: '<p onclick="alert(1)">Read</p><script>alert(1)</script><span data-universal-response-slot="safe"></span>' } }] } };
  sanitizeRuntimePackage(payload);
  assert.doesNotMatch(payload.treatment.pages[0].document.html, /onclick|script|alert/);
  assert.match(payload.treatment.pages[0].document.html, /data-universal-response-slot="safe"/);
});

test("retiring an inferred question reserves its answer identity rather than giving it to a later genuine learning check", async () => {
  const keys = ["Welcome", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Weekend", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Certificate"];
  const manuscript = keys.map(key => `${key.toUpperCase()}\n\n${key === "Day 1" ? "## The concept\n\nWhy does this happen?\n\nHere is the explanation.\n\n## Quick Check\n\n1. Why does this happen?\n\nAnswers:\n\nThe pattern repeats." : "Read the authored explanation."}`).join("\n\n");
  const source = await tools.adaptLearningSource(Buffer.from(manuscript), "MARKDOWN", "HAB", "test", "school", { title: "Habit Lab", slug: "habit" });
  const programme = JSON.parse((await tools.compileLearningEdition(source, "HAB", "test", "school")).content);
  const fields = programme.treatment.pages[1].document.fields;
  assert.equal(fields.length, 1);
  assert.ok(fields[0].sourceKey.endsWith("-2"), "The narrative's retired -1 response cannot supply an answer to the learning check.");
});

test("JSON source imports cannot select the old response-inference renderer", async () => {
  const source = await loadPreparedLearningSource("HAB", "school");
  const json = JSON.parse(new TextDecoder().decode(source.bytes));
  delete json.renderingModel;
  json.runtimeVersion = "programme-player-3";
  const compiled = JSON.parse((await tools.compileLearningEdition(Buffer.from(JSON.stringify(json)), "HAB", source.sourceVersion, "school")).content);
  assert.equal(compiled.runtimeVersion, "universal-authored-document-1");
  assert.ok(compiled.treatment.pages.every(page => page.document.schemaVersion === "universal-authored-document-1"));
});
