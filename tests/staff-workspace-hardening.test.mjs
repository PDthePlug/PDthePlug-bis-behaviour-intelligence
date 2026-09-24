import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("workspace is a dedicated authenticated programme surface", async () => {
  const page = await source("app/workspace/page.tsx");
  assert.match(page, /<StaffWorkspaceShell \/>/);
  assert.match(page, /requireUser\("\/workspace"\)/);
  assert.doesNotMatch(page, /<BISApp/);
  assert.match(page, /BIS programme delivery, organisation outcomes and administration/);
});

test("staff entry resolves roles automatically without a second open-workspace gate", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /fetch\("\/api\/staff"/);
  assert.match(shell, /setSession\(/);
  assert.match(shell, /setPerspective\(defaultPerspective\(roles\)\)/);
  assert.doesNotMatch(shell, /Open workspace/);
  assert.doesNotMatch(shell, /Open staff workspace/);
  assert.match(shell, /Opening your dashboard/);
});

test("workspace navigation exists only for roles that can use each surface", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /roles\.includes\("FACILITATOR"\)/);
  assert.match(shell, /roles\.includes\("SPONSOR_VIEWER"\) \|\| roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(shell, /roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(shell, /facilitatorAvailable \? \(/);
  assert.match(shell, /outcomesAvailable \? \(/);
  assert.match(shell, /adminAvailable \? \(/);
  assert.match(shell, /Programme results/);
  assert.match(shell, /Administration/);
  assert.doesNotMatch(shell, /Audit View/);
});

test("manual hide and inactivity use a privacy cover rather than re-authentication", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /setTimeout\(\(\) => setHidden\(true\), 120_000\)/);
  assert.match(shell, /document\.visibilityState === "hidden"/);
  assert.match(shell, /Workspace hidden/);
  assert.match(shell, /Reveal workspace/);
  assert.match(shell, /onClick=\{\(\) => setHidden\(true\)\}/);
});

test("facilitator workspace is four distinct working views instead of page anchors", async () => {
  const facilitator = await source("app/facilitator-workspace.tsx");
  for (const label of ["Group", "Learners", "Support", "Review"]) {
    assert.match(facilitator, new RegExp(">" + label + "<"));
  }
  assert.match(facilitator, /type FacilitatorSection = "cohort" \| "participants" \| "support" \| "review"/);
  assert.match(facilitator, /setSection\("participants"\)/);
  assert.doesNotMatch(facilitator, /href="#cohort-dashboard"/);
  assert.doesNotMatch(facilitator, /href="#learner-summaries"/);
  assert.doesNotMatch(facilitator, /href="#support-flags"/);
  assert.doesNotMatch(facilitator, /href="#readiness-review"/);
});

test("participant cards drill into facilitator-safe progress detail", async () => {
  const facilitator = await source("app/facilitator-workspace.tsx");
  assert.match(facilitator, /participant-card-button/);
  assert.match(facilitator, /setLearnerId\(learner\.userId\)/);
  assert.match(facilitator, /Open learner/);
  for (const field of ["Investigation", "Recorded days", "Opportunities", "Last activity", "Evidence position", "Observed strengths", "Where support may help", "Support history"]) {
    assert.match(facilitator, new RegExp(field));
  }
  for (const privateField of ["targetPattern", "targetCondition", "alternativeBehaviour", "expectedReward", "hypothesis", "Companion"]) {
    assert.doesNotMatch(facilitator, new RegExp(privateField));
  }
});

test("Administration remains the system-owner surface and technical checks are secondary", async () => {
  const view = await source("app/operations-view.tsx");
  assert.match(view, /<h1>Administration<\/h1>/);
  for (const label of ["Access", "Programmes", "Learners", "Activity", "Open support cases"]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /Advanced system checks/);
  assert.match(view, /How BIS reaches and protects results/);
  const adminIndex = view.indexOf("<AdminPanel");
  const checksIndex = view.indexOf("Advanced system checks");
  assert.ok(adminIndex >= 0 && checksIndex > adminIndex, "system management should appear before advanced checks");
});

test("advanced checks use understandable labels while preserving assurance tools", async () => {
  const view = await source("app/operations-view.tsx");
  for (const label of [
    "What BIS measures",
    "How a result is produced",
    "Calculation rules",
    "Where a result came from",
    "Privacy levels",
  ]) {
    assert.match(view, new RegExp(label));
  }
  for (const oldLabel of ["Evidence registry", "Calculation trace", "Formula versions", "Provenance map", "Privacy classification"]) {
    assert.doesNotMatch(view, new RegExp(oldLabel));
  }
});

test("staff hardening layer covers facilitator drilldown and mobile reflow", async () => {
  const css = await source("app/workspace/staff-workspace-hardening.css");
  assert.match(css, /\.staff-workspace-learner-link,[\s\S]*min-height:44px/);
  assert.match(css, /\.facilitator-subnav/);
  assert.match(css, /\.participant-card-button/);
  assert.match(css, /\.support-attention-grid/);
  assert.match(css, /\.review-participant-list/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});


test("learner-only profiles do not advertise staff access", async () => {
  const profile = await source("app/profile/profile-dashboard.tsx");
  assert.match(profile, /"SPONSOR_VIEWER"/);
  assert.match(profile, /\{staff \? \(/);
  assert.match(profile, /Open staff dashboard/);
  assert.match(profile, /\) : null\}/);
  assert.doesNotMatch(profile, /cannot be self-registered/i);
  assert.doesNotMatch(profile, /Facilitator and Audit access/i);
});

test("participant insight labels stay behavioural rather than personality based", async () => {
  const facilitator = await source("app/facilitator-workspace.tsx");
  for (const strength of [
    "Learning momentum",
    "Moved from planning into action",
    "Consistent observation",
    "Repeated real-world testing",
    "Evidence ready",
  ]) {
    assert.match(facilitator, new RegExp(strength));
  }
  assert.match(facilitator, /observable programme behaviour, not personality or ability/);
});
