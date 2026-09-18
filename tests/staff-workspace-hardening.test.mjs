import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("workspace is a dedicated staff surface rather than the legacy learner shell", async () => {
  const page = await source("app/workspace/page.tsx");
  assert.match(page, /<StaffWorkspaceShell \/>/);
  assert.match(page, /requireUser\("\/workspace"\)/);
  assert.doesNotMatch(page, /<BISApp/);
  assert.match(page, /Role-scoped BIS facilitator, programme outcomes and audit workspace/);
});

test("staff shell exposes role-appropriate facilitator, sponsor and audit views", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /roles\.includes\("FACILITATOR"\)/);
  assert.match(shell, /roles\.includes\("SAFEGUARDING_OFFICER"\)/);
  assert.match(shell, /roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(shell, /roles\.includes\("SPONSOR_VIEWER"\)/);
  assert.match(shell, /Facilitator View/);
  assert.match(shell, /Programme Outcomes/);
  assert.match(shell, /Audit View/);
  assert.match(shell, /<OperationsView initialRoles=\{session\.roles\} perspective=\{perspective\} \/>/);
  assert.match(shell, /href="\/habit"/);
});

test("staff privacy cover requires deliberate reveal and auto-hides", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /fetch\("\/api\/staff"/);
  assert.match(shell, /setTimeout\(\(\) => setVisible\(false\), 120_000\)/);
  assert.match(shell, /document\.visibilityState === "hidden"/);
  assert.match(shell, /Open staff workspace/);
  assert.match(shell, /Hide workspace/);
  assert.match(shell, /Sponsor reporting is aggregate-only/);
});

test("facilitator, sponsor and audit information architecture remains canonical", async () => {
  const view = await source("app/operations-view.tsx");
  for (const label of ["Cohort dashboard", "Learner summaries", "Support flags", "Readiness review"]) {
    assert.match(view, new RegExp(label));
  }
  for (const label of ["Evidence registry", "Calculation trace", "Formula versions", "Provenance map", "Privacy classification"]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /Human review, never automated diagnosis/);
  assert.match(view, /Use progress to plan support—not to rank people/);
  assert.match(view, /ProgrammeOutcomesView/);
  const outcomes = await source("app/programme-outcomes-view.tsx");
  for (const label of ["Action", "Prediction", "Experiment", "Evidence", "Change", "Support"]) {
    assert.match(outcomes, new RegExp(label));
  }
});

test("staff hardening layer enforces readable text, touch targets and mobile reflow", async () => {
  const css = await source("app/workspace/staff-workspace-hardening.css");
  assert.match(css, /\.staff-workspace-learner-link,[\s\S]*min-height:44px/);
  assert.match(css, /\.staff-workspace-shell \.ops-learner-card dt\{font-size:12px/);
  assert.match(css, /\.staff-workspace-shell \.ops-learner-card dd\{font-size:14px/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.staff-workspace-shell \.ops-learner-grid,[\s\S]*grid-template-columns:1fr/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
