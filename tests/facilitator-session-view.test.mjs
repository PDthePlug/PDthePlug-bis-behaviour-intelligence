import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("facilitators get a dedicated classroom session view instead of learner-facing timing", async () => {
  const [workspace, learner] = await Promise.all([
    source("app/facilitator-workspace.tsx"),
    source("app/learning/programme-player.tsx"),
  ]);

  assert.match(workspace, /type FacilitatorSection = "cohort" \| "session"/);
  assert.match(workspace, />Session<\/button>/);
  assert.match(workspace, /Facilitation experience/);
  assert.match(workspace, /Run the room/);
  assert.match(workspace, /Facilitator moves/);
  assert.match(workspace, /Watch for/);
  assert.match(workspace, /Close the session/);
  assert.match(workspace, /BIS facilitation stance/);
  assert.match(workspace, /45-minute facilitation rhythm/);
  assert.doesNotMatch(learner, /prototype-session-plan/);
  assert.doesNotMatch(learner, /3 learning checks/);
  assert.doesNotMatch(learner, /facilitator moment/);
});

test("facilitator session view can mirror static learner material without exposing learner responses", async () => {
  const workspace = await source("app/facilitator-workspace.tsx");

  assert.match(workspace, /\/api\/runtime-content\?kind=LEARNING_MODULE/);
  assert.match(workspace, /Read-only learner material preview/);
  assert.match(workspace, /Responses remain private and are not shown here/);
  assert.match(workspace, /dangerouslySetInnerHTML=\{\{ __html: learnerPreviewHtml \}\}/);
  assert.match(workspace, /strip|EXISTING\\s\+BIS\\s\+LAB\\s\+PLATFORM/i);
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
