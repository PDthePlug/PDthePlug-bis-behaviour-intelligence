import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("handbook reader enhances authored pages before restoring saved responses", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /enhanceHandbookDocument/);
  assert.match(player, /enhanceHandbookDocument\(documentRoot, moduleCode, page\.id, \{/);
  assert.match(player, /querySelectorAll<HTMLTextAreaElement \| HTMLInputElement \| HTMLSelectElement>\("\[data-field-id\]"\)/);
});

test("checkpoint questions receive stable responses without scanning every question on the page", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  assert.match(enhancement, /function checkpointQuestionElements/);
  assert.match(enhancement, /filter\(isCheckpointHeading\)/);
  assert.match(enhancement, /addMissingCheckpointResponses/);
  assert.match(enhancement, /\.WB\.AUTO\./);
  assert.match(enhancement, /dataset\.purpose = "LEARNING_RESPONSE"/);
  assert.match(enhancement, /dataset\.privacyClass = "P3"/);
  assert.match(enhancement, /placeholder = "Write your answer…"/);
  assert.match(enhancement, /hasExistingAnswerSpace/);
  assert.doesNotMatch(enhancement, /querySelectorAll<HTMLElement>\("p,li,h2,h3,h4,\.authored-lines,\.handbook-callout"\)/);
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
  assert.match(player, /enhanceHandbookDocument\(documentRoot, moduleCode, page\.id, \{/);
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
  assert.match(player, /snapshot\?\.workbookResponses/);
  assert.match(player, /knownValues/);
  assert.match(player, /snapshot\?\.profile\.displayName/);
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
  assert.match(enhancement, /removeUnboundGenericResponses/);
  assert.match(enhancement, /const run = \[field\]/);
  assert.match(enhancement, /promptsBeforeResponseRun/);
  assert.match(enhancement, /upgradePrintableCheckboxes/);
  assert.match(enhancement, /input\.type = exclusiveGroup \? "radio" : "checkbox"/);
  assert.match(enhancement, /convertSimplePaperBlanks/);
  assert.match(enhancement, /convertNumberedPaperBlanks/);
  assert.match(enhancement, /convertPriorityWorksheetRows/);
  assert.match(enhancement, /applyKnownTableValues/);
  assert.match(enhancement, /inputType: "text" \| "number" \| "date"/);
  assert.match(enhancement, /enhanceTables/);
  assert.match(enhancement, /handbook-data-table/);
  assert.match(enhancement, /hideEditorialProductionMetadata/);

  assert.match(css, /\.handbook-check-row/);
  assert.match(css, /\.handbook-system-value/);
  assert.match(css, /\.handbook-inline-field/);
  const presentation = await source("app/learning/handbook-presentation.css");
  assert.match(presentation, /display: table-cell/);
  assert.match(presentation, /thead \{display: table-header-group/);
  assert.match(presentation, /overflow-x: auto/);
});

test("system-known values are module-scoped and do not reuse Habit evidence in other Labs", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /loadLearningLabRuntime\(moduleCode, fetch, controller\.signal\)/);
  assert.match(await source("lib/learning-lab-runtime.mjs"), /\/api\/labs\?lab=/);
  assert.match(player, /moduleLive = moduleRuntimeResult/);
  assert.match(player, /const activeModuleRuntime = moduleRuntime/);
  assert.match(player, /EXPERIMENT\.OPPORTUNITY_COUNT/);
  assert.match(player, /Observation days completed/);
  assert.match(player, /From your Lab/);
});


test("duplicate cleanup preserves one field per explicit multi-question prompt", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");

  assert.match(enhancement, /function promptsBeforeResponseRun/);
  assert.match(enhancement, /flatMap\(\(item\) => questionPrompts\(item\)\)/);
  assert.match(enhancement, /const keepCount = Math\.min\(run\.length, Math\.max\(1, prompts\.length\)\)/);
  assert.match(enhancement, /const prompt = prompts\[index\]/);
  assert.match(enhancement, /item\.setAttribute\("aria-label", prompt\)/);
});


test("future-self and certificate paper fields are digitised without inventing learner identifiers", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");

  assert.match(enhancement, /Grade for future-self letter/);
  assert.match(enhancement, /From: \$\{context\.learnerName\}/);
  assert.match(enhancement, /Workbook record: linked to your BIS learning profile/);
  assert.match(enhancement, /Facilitator confirmation: added by your programme facilitator/);
  assert.doesNotMatch(enhancement, /Workbook ID: \$\{context\.workbookId\}/);
});

test("system-owned workbook figures never degrade into learner calculation boxes", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /const pending = "Available after your Lab record is complete"/);
  assert.match(player, /const notRecorded = "Not recorded in your Lab yet"/);
  assert.match(player, /Current Lab record — updates as you record each day/);
  assert.ok(player.includes("N/A — no eligible opportunities"));
  assert.match(player, /Not separately recorded/);
  assert.match(player, /typeof value === "number"/);
});

test("generated paper fields stay unique when the same label appears twice on one page", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");

  assert.match(enhancement, /identitySeed = labelText/);
  assert.match(enhancement, /const occurrences = new Map<string, number>\(\)/);
  assert.match(enhancement, /occurrences\.set\(labelText, occurrence\)/);
  assert.match(enhancement, /`\$\{labelText\}\|\$\{occurrence\}`/);
});

test("planned Labs keep post-Day-3 handbook pages as honest reference material", async () => {
  const [enhancement, player] = await Promise.all([
    source("app/learning/handbook-document-enhancements.ts"),
    source("app/learning/programme-player.tsx"),
  ]);

  assert.match(enhancement, /hardenReferenceOnlyLabContent/);
  assert.match(enhancement, /This section follows the Lab once it is available and completed/);
  assert.match(enhancement, /This review section is used after the seven-day Lab experiment/);
  assert.match(enhancement, /Available when the live Lab is connected/);
  assert.match(enhancement, /source: "Reference only"/);
  assert.match(player, /labAvailable: moduleLabIsLive/);
  assert.match(player, /!moduleLabIsLive/);
});

test("shared learner shell uses the active module Lab rather than leaking Habit state", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /const activeModuleRuntime = moduleRuntime/);
  assert.match(player, /programmeHandoff\?\.experimentStarted/);
  assert.match(player, /experimentRecordedDays/);
  assert.doesNotMatch(player, /moduleCode === "HAB" && runtime\.experiment/);
});
