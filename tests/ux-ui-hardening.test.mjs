import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("phone staff surfaces keep information density instead of stacking every card", async () => {
  const css = await source("app/responsive-readiness.css");
  assert.match(css, /staff-workspace-switcher\{[^}]*grid-template-columns:repeat\(3,minmax\(112px,1fr\)\)/);
  assert.match(css, /staff-workspace-main \.ops-metrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /programme-outcomes \.outcomes-context\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /journey-activity-strip\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /outcome-metric-row\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("customer-facing staff language explains intent without internal role jargon", async () => {
  const [shell, operations, outcomes, signIn, facilitator] = await Promise.all([
    source("app/workspace/staff-workspace-shell.tsx"),
    source("app/operations-view.tsx"),
    source("app/programme-outcomes-view.tsx"),
    source("app/sign-in/sign-in-form.tsx"),
    source("app/facilitator-workspace.tsx"),
  ]);
  assert.match(shell, /Programme results/);
  assert.match(shell, /Administration/);
  assert.doesNotMatch(shell, /BIS Administrator/);
  assert.match(operations, /Learners in BIS/);
  assert.match(operations, /Group count only/);
  assert.match(outcomes, /Usable responses/);
  assert.match(outcomes, /Responses recorded/);
  assert.match(facilitator, />Group<\/button>/);
  assert.match(facilitator, />Learners<\/button>/);
  assert.doesNotMatch(signIn, /Authentication verifies your identity/);
});

test("reader back navigation is task-aware and leaving is explicit", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /useSearchParams/);
  assert.match(player, /params\.set\("page", String\(next \+ 1\)\)/);
  assert.match(player, /goToProgrammePage\(selected - 1\)/);
  assert.match(player, /<ArrowLeft \/> Exit reader/);
});

test("only the Leap9 synthetic demonstration fixture is generated", async () => {
  const seed = await source("scripts/seed-bis-reporting-demo.sql");
  assert.match(seed, /LEAP9-DEMO-HAB-20/);
  assert.match(seed, /'Leap9'/);
  assert.match(seed, /leap9\.demo\./);
  assert.doesNotMatch(seed, /BIS Demonstration — 20-person Habit Lab/);
  assert.match(seed, /Thando Mokoena/);
  assert.match(seed, /Lwazi Nxumalo/);
});


test("staff views and facilitator tasks participate in browser history", async () => {
  const [shell, facilitator] = await Promise.all([
    source("app/workspace/staff-workspace-shell.tsx"),
    source("app/facilitator-workspace.tsx"),
  ]);
  assert.match(shell, /params\.set\("view", next\)/);
  assert.match(shell, /router\.push\(/);
  assert.match(facilitator, /params\.set\("section", patch\.section\)/);
  assert.match(facilitator, /params\.set\("learner", patch\.learner\)/);
  assert.match(facilitator, /navigateWorkspace\(\{ section: "participants", learner: learner\.userId \}\)/);
});


test("customer-facing language stays plain across learner, facilitator and organisation surfaces", async () => {
  const [signIn, profile, player, facilitator, operations, outcomes, pdf] = await Promise.all([
    source("app/sign-in/sign-in-form.tsx"),
    source("app/profile/profile-dashboard.tsx"),
    source("app/learning/programme-player.tsx"),
    source("app/facilitator-workspace.tsx"),
    source("app/operations-view.tsx"),
    source("app/programme-outcomes-view.tsx"),
    source("lib/programme-report-pdf.ts"),
  ]);

  assert.match(signIn, /BIS will open the right version of your learning programme/);
  assert.match(profile, /Open programme workspace/);
  assert.match(player, /Seven-day real-world test/);
  assert.match(facilitator, /No learner currently needs a check-in/);
  assert.match(operations, /Programme results · view only/);
  assert.match(outcomes, /What the programme can learn/);
  assert.match(outcomes, /Programme decisions/);
  assert.match(pdf, /How much information we have/);

  const visibleSources = [signIn, profile, player, facilitator, operations, outcomes, pdf].join("\n");
  for (const phrase of [
    "authored handbook edition",
    "Role-restricted operational view",
    "Seven-day field evidence",
    "Opening restricted operations",
    "Programme-design insight",
    "Decision register",
    "Evidence strength",
    "calibration checkpoint",
    "No structural support flags",
  ]) {
    assert.doesNotMatch(visibleSources, new RegExp(phrase));
  }
});


test("access failures stay customer-safe and never expose backend error text", async () => {
  const [router, shell] = await Promise.all([
    source("app/role-router.tsx"),
    source("app/workspace/staff-workspace-shell.tsx"),
  ]);

  assert.match(router, /We couldn&apos;t open your BIS workspace/);
  assert.match(router, /Getting your learning and programme access ready/);
  assert.doesNotMatch(router, /snapshot\.error \|\|/);
  assert.doesNotMatch(router, /resolve your dashboard/);

  assert.match(shell, /We couldn't open the programme workspace/);
  assert.match(shell, /does not have access to the programme workspace/);
  assert.doesNotMatch(shell, /payload\.error \|\|/);
});

test("password recovery routes use the compact responsive authentication story", async () => {
  const [forgot, reset, cleanup] = await Promise.all([
    source("app/forgot-password/page.tsx"),
    source("app/reset-password/page.tsx"),
    source("app/sign-in/sign-in-cleanup.css"),
  ]);

  assert.match(forgot, /sign-in\/sign-in-cleanup\.css/);
  assert.match(reset, /sign-in\/sign-in-cleanup\.css/);
  assert.match(cleanup, /@media \(max-width: 860px\)/);
  assert.match(cleanup, /min-height: auto/);
});


test("Learn and Lab use one governed learner-document system", async () => {
  const [layout, player, labFrame, sharedCss, handbookCss, contract] = await Promise.all([
    source("app/layout.tsx"),
    source("app/learning/programme-player.tsx"),
    source("app/lab-investigation-frame.tsx"),
    source("app/learner-document-system.css"),
    source("app/learning/handbook-presentation.css"),
    source("docs/UNIFIED_LEARNER_DOCUMENT_SYSTEM.md"),
  ]);

  assert.match(layout, /learner-document-system\.css/);
  for (const token of [
    "learner-document-stage",
    "learner-document",
    "learner-document-header",
    "learner-document-title",
    "learner-document-purpose",
    "learner-document-outcomes",
    "learner-document-meta",
    "learner-document-body",
  ]) {
    assert.match(player, new RegExp(token), `ProgrammePlayer must use ${token}`);
    assert.match(labFrame, new RegExp(token), `Lab frame must use ${token}`);
  }
  assert.match(player, /sessionDesign\?\.dayPurpose/);
  assert.match(player, /sessionDesign\.learnerOutcome/);
  assert.match(labFrame, /investigation\.mission/);
  assert.match(labFrame, /investigation\.produces/);
  assert.match(sharedCss, /BIS Unified Learner Document System/);
  assert.match(sharedCss, /--learner-document-accent/);
  assert.match(sharedCss, /font:650 clamp\(38px,5vw,52px\)\/1\.02 var\(--font-serif\)/);
  assert.match(contract, /must not rewrite, shorten, reorder, reinterpret/);
  assert.match(handbookCss, /Preserve table relationships on phones/);
  assert.doesNotMatch(handbookCss, /handbook-stacked-table tbody[^\n]*display:\s*block/);
});
