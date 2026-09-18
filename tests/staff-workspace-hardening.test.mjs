import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("workspace is a dedicated programme surface", async () => {
  const page = await source("app/workspace/page.tsx");
  assert.match(page, /<StaffWorkspaceShell \/>/);
  assert.match(page, /requireUser\("\/workspace"\)/);
  assert.doesNotMatch(page, /<BISApp/);
  assert.match(page, /BIS programme delivery, organisation outcomes and administration/);
});

test("workspace navigation is concise and role appropriate", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /roles\.includes\("FACILITATOR"\)/);
  assert.match(shell, /roles\.includes\("SAFEGUARDING_OFFICER"\)/);
  assert.match(shell, /roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(shell, /roles\.includes\("SPONSOR_VIEWER"\)/);
  for (const label of ["Facilitator", "Programme Outcomes", "BIS Administrator"]) {
    assert.match(shell, new RegExp(label));
  }
  assert.doesNotMatch(shell, /Audit View/);
  assert.doesNotMatch(shell, /Behavioural evidence for sponsors/);
  assert.match(shell, /<OperationsView initialRoles=\{session\.roles\} perspective=\{perspective\} \/>/);
});

test("workspace opens deliberately and auto hides", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /fetch\("\/api\/staff"/);
  assert.match(shell, /setTimeout\(\(\) => setVisible\(false\), 120_000\)/);
  assert.match(shell, /document\.visibilityState === "hidden"/);
  assert.match(shell, /Open workspace/);
  assert.match(shell, /Hide workspace/);
  assert.match(shell, /Workspace hides after two minutes of inactivity/);
});

test("workspace removes orientation explainers and executes each role directly", async () => {
  const view = await source("app/operations-view.tsx");
  assert.doesNotMatch(view, /function OperationsOrientation/);
  for (const phrase of ["Where you are", "What this means", "Do now", "What happens next", "Least-privilege access"]) {
    assert.doesNotMatch(view, new RegExp(phrase));
  }
  for (const label of ["Cohort", "Participants", "Support", "Review"]) {
    assert.match(view, new RegExp(label));
  }
});

test("BIS Administrator is the primary system-owner surface and technical checks are secondary", async () => {
  const view = await source("app/operations-view.tsx");
  assert.match(view, /<h1>Administrator<\/h1>/);
  for (const label of ["Access", "Programmes", "Participants", "Activity", "Safeguarding cases"]) {
    assert.match(view, new RegExp(label));
  }
  assert.match(view, /Advanced system checks/);
  assert.match(view, /Evidence and calculation checks/);
  const adminIndex = view.indexOf("<AdminPanel");
  const checksIndex = view.indexOf("Advanced system checks");
  assert.ok(adminIndex >= 0 && checksIndex > adminIndex, "system management should appear before advanced checks");
  assert.doesNotMatch(view, /Open governance controls/);
});

test("advanced checks use understandable labels while preserving the underlying assurance tools", async () => {
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

test("staff hardening layer enforces readable text, touch targets and mobile reflow", async () => {
  const css = await source("app/workspace/staff-workspace-hardening.css");
  assert.match(css, /\.staff-workspace-learner-link,[\s\S]*min-height:44px/);
  assert.match(css, /\.staff-workspace-shell \.ops-learner-card dt\{font-size:12px/);
  assert.match(css, /\.staff-workspace-shell \.ops-learner-card dd\{font-size:14px/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.staff-workspace-shell \.ops-learner-grid,[\s\S]*grid-template-columns:1fr/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
