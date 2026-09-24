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
