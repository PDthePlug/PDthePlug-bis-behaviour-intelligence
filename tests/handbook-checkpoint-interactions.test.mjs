import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("handbook reader enhances authored pages before restoring saved responses", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /enhanceHandbookDocument/);
  assert.match(player, /enhanceHandbookDocument\(documentRoot, moduleCode, page\.id\)/);
  assert.match(player, /querySelectorAll<HTMLTextAreaElement>\("textarea\[data-field-id\]"\)/);
});

test("every uncovered question can receive a stable private workbook response", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  assert.match(enhancement, /plain\.endsWith\("\?"\)/);
  assert.match(enhancement, /matchAll\(\/\(\?:\^\|\\n\).*\\\?/);
  assert.match(enhancement, /\.WB\.AUTO\./);
  assert.match(enhancement, /data\.purpose = "LEARNING_RESPONSE"|dataset\.purpose = "LEARNING_RESPONSE"/);
  assert.match(enhancement, /dataset\.privacyClass = "P3"/);
  assert.match(enhancement, /placeholder = "Write your answer…"/);
  assert.match(enhancement, /hasExistingAnswerSpace/);
});

test("suggested checkpoint answers are collapsed by default and excluded from response generation", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  const css = await source("app/learning/programme-player.css");
  assert.match(enhancement, /document\.createElement\("details"\)/);
  assert.match(enhancement, /checkpoint-answer-panel/);
  assert.match(enhancement, /Show suggested answers/);
  assert.match(enhancement, /Hide suggested answers/);
  assert.match(enhancement, /closest\("\.checkpoint-answer-panel"\)/);
  assert.doesNotMatch(enhancement, /details\.open\s*=\s*true/);
  assert.match(css, /\.checkpoint-answer-panel\[open\]/);
});

test("formal Lab references remain read-only and do not get duplicate workbook boxes", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  const player = await source("app/learning/programme-player.tsx");
  assert.match(enhancement, /closest\("\.prototype-reference"\)/);
  assert.match(player, /data\.purpose === "FORMAL_LAB_REFERENCE"|dataset\.purpose === "FORMAL_LAB_REFERENCE"/);
});
