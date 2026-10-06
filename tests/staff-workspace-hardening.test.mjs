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
  assert.match(shell, /defaultPerspective\(session\.roles\)/);
  assert.match(shell, /params\.set\("view", view\)/);
  assert.match(shell, /router\.push\(/);
  assert.doesNotMatch(shell, /Open workspace/);
  assert.doesNotMatch(shell, /Open staff workspace/);
  assert.match(shell, /Opening your dashboard/);
});

test("workspace navigation exists only for roles that can use each surface", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /roles\.includes\("FACILITATOR"\)/);
  assert.match(shell, /roles\.includes\("SPONSOR_VIEWER"\) \|\| roles\.includes\("PROGRAMME_OWNER"\) \|\| roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(shell, /roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(shell, /facilitatorAvailable \? \[{label:/);
  assert.match(shell, /outcomesAvailable \? \[{label:/);
  assert.match(shell, /adminAvailable \? \[{label:/);
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

test("facilitator workspace keeps four operational views and opens learning through the shared learner experience", async () => {
  const facilitator = await source("app/facilitator-workspace.tsx");
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  for (const label of ["Group", "Learners", "Support", "Review"]) assert.ok(shell.includes(`"${label}"`));
  assert.match(shell, /<WorkspaceMenu groups=\{menuGroups\}/);
  assert.doesNotMatch(facilitator, /facilitator-subnav/);
  assert.doesNotMatch(shell, /staff-workspace-switcher/);
  assert.doesNotMatch(facilitator, />Session<\/button>/);
  assert.match(facilitator, /Learner experience/);
  assert.match(facilitator, /type FacilitatorSection = "cohort" \| "participants" \| "support" \| "review"/);
  assert.match(facilitator, /navigateWorkspace\(\{ section: "participants"/);
  assert.doesNotMatch(facilitator, /href="#cohort-dashboard"/);
  assert.doesNotMatch(facilitator, /href="#learner-summaries"/);
  assert.doesNotMatch(facilitator, /href="#support-flags"/);
  assert.doesNotMatch(facilitator, /href="#readiness-review"/);
});

test("compact participant rows drill into facilitator-safe progress detail", async () => {
  const facilitator = await source("app/facilitator-workspace.tsx");
  assert.match(facilitator, /participant-roster-row/);
  assert.match(facilitator, /learner: learner\.userId/);
  assert.match(facilitator, /Open learner/);
  for (const field of ["Investigation", "Recorded days", "Opportunities", "Last activity", "Evidence position", "Recorded activity", "Where support may help", "Support history"]) {
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
  assert.match(profile, /Open programme workspace/);
  assert.match(profile, /\) : null\}/);
  assert.doesNotMatch(profile, /cannot be self-registered/i);
  assert.doesNotMatch(profile, /Facilitator and Audit access/i);
});

test("participant activity labels describe records without unsupported behavioural conclusions", async () => {
  const facilitator = await source("app/facilitator-workspace.tsx");
  for (const strength of [
    "Reached the mapping activity",
    "Experiment start recorded",
    "observation days recorded",
    "opportunities recorded",
    "Minimum opportunity count reached",
  ]) {
    assert.match(facilitator, new RegExp(strength));
  }
  assert.match(facilitator, /does not establish evidence quality, ability or behaviour change/);
  assert.doesNotMatch(facilitator, /Repeated real-world testing|No real-world opportunity yet|Completed the learning cycle/);
});


test("programme owner opens Programme results without gaining administration", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /roles\.includes\("PROGRAMME_OWNER"\)/);
  assert.match(shell, /return "outcomes"/);
  assert.match(shell, /roles\.includes\("SYSTEM_ADMIN"\)/);
});


test("administration supports scoped facilitators editable access and one-pass programme onboarding", async () => {
  const [view, route, schema, migration] = await Promise.all([
    source("app/operations-view.tsx"),
    source("app/api/staff/route.ts"),
    source("db/schema.ts"),
    source("supabase/migrations/20261001123500_programme_onboarding.sql"),
  ]);

  assert.match(view, /Edit access/);
  assert.match(view, /updateRoleAssignment/);
  assert.match(view, /role === "FACILITATOR" \|\| role === "SPONSOR_VIEWER" \|\| role === "PROGRAMME_OWNER"/);
  assert.match(view, /Create a group/);
  assert.match(view, /Programme format/);
  assert.match(view, /Participant emails/);
  assert.match(view, /addCohortParticipants/);

  assert.match(route, /bis_create_programme_group/);
  assert.match(route, /labPlan/);
  assert.match(route, /bis_add_programme_participants/);
  assert.match(route, /scopeType: "GLOBAL" \| "COHORT"/);
  assert.match(route, /role === "FACILITATOR"/);
  assert.match(route, /cohortParticipantInvites/);

  assert.match(schema, /programmeFormat: text\("programme_format"\)/);
  assert.match(schema, /labCodes: text\("lab_codes"\)/);
  assert.match(schema, /cohortParticipantInvites/);

  assert.match(migration, /alter column facilitator_email drop not null/);
  assert.match(migration, /create table if not exists public\.cohort_participant_invites/);
  assert.match(migration, /r\.scope_type = 'COHORT'/);
});

test("pending participant emails are claimed automatically when the learner completes setup", async () => {
  const route = await source("app/api/bis/route.ts");
  assert.match(route, /rpc\("bis_claim_programme_invites"\)/);
  const worker=await source("supabase/migrations/20261005151940_workspace_consolidation_integrity.sql");
  assert.match(worker, /lower\(q.email\)=private.current_email\(\)/);
  assert.match(worker, /claimed_user_id=uid/);
  assert.match(worker, /status='CLAIMED'/);
  assert.match(worker, /insert into public.cohort_members/);
});
