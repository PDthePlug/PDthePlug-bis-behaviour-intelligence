import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("handbook reader enhances authored pages before restoring saved responses", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /enhanceHandbookDocument/);
  assert.match(player, /enhanceHandbookDocument\(documentRoot, moduleCode, page\.id\)/);
  assert.match(player, /querySelectorAll<HTMLTextAreaElement \| HTMLInputElement \| HTMLSelectElement>\("\[data-field-id\]"\)/);
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
  assert.match(enhancement, /p,li,h2,h3,h4/);
});

test("suggested checkpoint answers are collapsed by default and excluded from response generation", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  const css = await source("app/learning/programme-player.css");
  assert.match(enhancement, /document\.createElement\("details"\)/);
  assert.match(enhancement, /checkpoint-answer-panel/);
  assert.ok(enhancement.includes('<strong>Answers</strong><small>Tap to reveal</small>'));
  assert.ok(enhancement.includes('<strong>Answers</strong><small>Tap to hide</small>'));
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


test("checkpoint enhancement reruns deterministically when the reader advances pages", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /useLayoutEffect/);
  assert.match(player, /enhanceHandbookDocument\(documentRoot, moduleCode, page\.id\)/);
  assert.match(player, /\[learnMode, moduleCode, page\?\.id, section\]/);
  assert.match(player, /<article key=\{page\.id\} ref=\{documentRef\}/);

  const enhancementBlock = player.slice(
    player.indexOf("enhanceHandbookDocument(documentRoot, moduleCode, page.id)"),
    player.indexOf("useEffect(() => {\n    if (saveState")
  );
  assert.doesNotMatch(enhancementBlock, /requestAnimationFrame/);
  assert.doesNotMatch(enhancementBlock, /cancelAnimationFrame/);
});

test("response hydration is separate from page enhancement so workbook updates cannot cancel checkpoint setup", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const matches = player.match(/useLayoutEffect\(\(\) => \{/g) ?? [];
  assert.ok(matches.length >= 2);
  assert.match(player, /\[drafts, learnMode, page\?\.id, section, snapshot\?\.workbookResponses\]/);
});


test("reader repairs checkpoint controls if a later React render replaces enhanced handbook HTML", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /const restoreHandbookInteractions = useCallback/);
  assert.match(player, /new MutationObserver/);
  assert.match(player, /observer\.observe\(documentRoot, \{ childList: true, subtree: true \}\)/);
  assert.match(player, /queueMicrotask\(\(\) => \{/);
  assert.match(player, /restoreHandbookInteractions\(\)/);
});

test("complete and continue settles save state before entering the next handbook page", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const completeStart = player.indexOf("async function completePage()");
  const completeEnd = player.indexOf("if (error && !programme)");
  const complete = player.slice(completeStart, completeEnd);

  assert.match(complete, /let nextPageIndex: number \| null = null/);
  assert.match(complete, /setSaving\(false\);\s*setCompleting\(false\);/);
  assert.match(complete, /window\.setTimeout\(\(\) => goToProgrammePage\(nextPageIndex!\), 0\)/);
  assert.ok(
    complete.indexOf("setCompleting(false)") < complete.lastIndexOf("goToProgrammePage(nextPageIndex!)"),
    "page navigation must happen after completion state settles",
  );
});
