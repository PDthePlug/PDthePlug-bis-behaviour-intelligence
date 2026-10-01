import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("facilitator uses the same learner experience with role-specific cues instead of a second session dashboard", async () => {
  const [workspace, player, entry, enhancement] = await Promise.all([
    source("app/facilitator-workspace.tsx"),
    source("app/learning/programme-player.tsx"),
    source("app/habit/programme-entry.tsx"),
    source("app/learning/handbook-document-enhancements.ts"),
  ]);

  assert.doesNotMatch(workspace, /type FacilitatorSection = "cohort" \| "session"/);
  assert.doesNotMatch(workspace, />Session<\/button>/);
  assert.doesNotMatch(workspace, /Facilitation experience/);
  assert.match(workspace, /Learner experience/);
  assert.match(workspace, /facilitator=1/);
  assert.match(entry, /viewerMode="facilitator"/);
  assert.match(player, /facilitator-viewer/);
  assert.match(player, /Read together, then ask before you explain/);
  assert.match(player, /End with the learner, not with another explanation/);
  assert.match(enhancement, /Facilitator cue · write first/);
  assert.match(enhancement, /Facilitator cue · ask the room/);
});

test("facilitator learner view is read-only and never loads learner workbook responses", async () => {
  const [player, entry] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/habit/programme-entry.tsx"),
  ]);

  assert.match(player, /workbookResponses: \{\}/);
  assert.match(player, /if \(facilitatorMode\) \{/);
  assert.match(player, /field\.disabled = true/);
  assert.match(player, /Learners write here/);
  assert.match(player, /learner responses are private and are not shown or saved here/);
  assert.match(player, /if \(readOnlyMode\) return true/);
  assert.match(entry, /data\.roles\.includes\("FACILITATOR"\)/);
  assert.match(entry, /cohort\.labCode !== moduleCode/);
});

test("facilitator shared learner view resolves the assigned cohort edition", async () => {
  const entry = await source("app/habit/programme-entry.tsx");

  assert.match(entry, /fetch\("\/api\/staff"/);
  assert.match(entry, /learner\.cohortId \? learner\.cohortId === cohort\.id/);
  assert.match(entry, /deliveryEdition/);
  assert.match(entry, /editions\.length === 1 \? editions\[0\]! : "school"/);
});

test("facilitator progress is scoped to each cohort Lab and carries edition context", async () => {
  const staff = await source("app/api/staff/route.ts");

  assert.match(staff, /deliveryEdition: learners\.deliveryEdition/);
  assert.match(staff, /cohorts\.map\(async \(cohort\)/);
  assert.match(staff, /progressRows\(\[\.\.\.new Set\(cohortUserIds\)\], cohort\.labCode\)/);
  assert.match(staff, /cohortId: cohort\.id/);
  assert.match(staff, /labCode: cohort\.labCode/);
  assert.doesNotMatch(staff, /progressRows\(\[\.\.\.new Set\(members\.map\([^)]*\)\)\], "HAB"\)/);
});

test("facilitator guidance follows BIS discovery-first facilitation principles", async () => {
  const guide = await source("lib/facilitator-session.ts");

  assert.match(guide, /Create the conditions for discovery/);
  assert.match(guide, /ask a better question/);
  assert.match(guide, /Use silence deliberately/);
  assert.match(guide, /without turning observations into judgments/);
  assert.match(guide, /Do not begin the 90-minute Lab inside the 45-minute learning session/);
  assert.match(guide, /Phase A is the separate facilitated investigation/);
});
