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
  assert.match(player, /const restoreHandbookInteractions = useCallback/);
  assert.match(player, /enhanceHandbookDocument\(documentRoot, moduleCode, page\.id\)/);
  assert.match(player, /<article key=\{page\.id\} ref=\{documentRef\}/);

  const enhancementBlock = player.slice(
    player.indexOf("const restoreHandbookInteractions = useCallback"),
    player.indexOf("useEffect(() => {\n    if (saveState")
  );
  assert.doesNotMatch(enhancementBlock, /requestAnimationFrame/);
  assert.doesNotMatch(enhancementBlock, /cancelAnimationFrame/);
});

test("saved and draft responses are restored whenever checkpoint controls are rebuilt", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const repairStart = player.indexOf("const restoreHandbookInteractions = useCallback");
  const repairEnd = player.indexOf("useLayoutEffect(() =>", repairStart);
  const repair = player.slice(repairStart, repairEnd);

  assert.match(repair, /drafts\[id\] \?\? snapshot\?\.workbookResponses\?\.\[id\]\?\.value \?\? ""/);
  assert.match(repair, /field\.value = savedValue/);
  assert.match(player, /\[drafts, learnMode, moduleCode, page, section, snapshot\?\.workbookResponses\]/);
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


test("digital hardening removes orphan controls and upgrades paper-era interactions", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  const css = await source("app/learning/programme-player.css");

  assert.match(enhancement, /cleanOrphanedResponseControls/);
  assert.match(enhancement, /previous instanceof HTMLTextAreaElement/);
  assert.match(enhancement, /upgradePrintableCheckboxes/);
  assert.match(enhancement, /input\.type = exclusiveGroup \? "radio" : "checkbox"/);
  assert.match(enhancement, /convertSimplePaperBlanks/);
  assert.match(enhancement, /inputType: "text" \| "number" \| "date"/);
  assert.match(enhancement, /enhanceTables/);
  assert.match(enhancement, /handbook-data-table/);
  assert.match(enhancement, /hideEditorialProductionMetadata/);

  assert.match(css, /\.handbook-check-row/);
  assert.match(css, /\.handbook-system-value/);
  assert.match(css, /\.handbook-inline-field/);
  assert.match(css, /td\[data-label\]::before/);
});

test("system-known values are module-scoped and do not reuse Habit evidence in other Labs", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /\["DEC", "MON"\]\.includes\(moduleCode\)/);
  assert.match(player, /\/api\/labs\?lab=/);
  assert.match(player, /moduleLive = moduleCode === "HAB" \? live : moduleRuntimeResult/);
  assert.match(player, /const activeModuleRuntime = moduleCode === "HAB" \? runtime : moduleRuntime/);
  assert.match(player, /EXPERIMENT\.OPPORTUNITY_COUNT/);
  assert.match(player, /Observation days completed/);
  assert.match(player, /From your Lab/);
});
