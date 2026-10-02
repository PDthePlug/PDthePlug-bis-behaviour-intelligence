import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/canonical-adaptive-shell.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/canonical-shell.css", import.meta.url), "utf8");
const habitLayout = readFileSync(new URL("../app/habit/layout.tsx", import.meta.url), "utf8");
const labLayout = readFileSync(new URL("../app/habit-lab/layout.tsx", import.meta.url), "utf8");

test("canonical learner shell owns the Habit programme and focused Habit tools", () => {
  assert.match(habitLayout, /CanonicalAdaptiveShell/);
  assert.match(labLayout, /CanonicalAdaptiveShell/);
  assert.match(habitLayout, /canonical-shell\.css/);
  assert.match(labLayout, /canonical-shell\.css/);
});

test("canonical learner navigation preserves the accepted BIS journey and adds Profile", () => {
  for (const label of ["Today", "Learn", "Lab", "Experiment", "Profile"]) {
    assert.ok(shell.includes(`label: "${label}"`), `${label} should remain in the canonical learner menu`);
  }
  assert.match(shell, /href: "\/habit"/);
  assert.match(shell, /href: "\/learn"/);
  assert.match(shell, /href: "\/labs"/);
  assert.match(shell, /"\/habit-lab\/experiment"/);
  assert.match(shell, /"\/decision\?step=7"/);
  assert.match(shell, /"\/money\?step=7"/);
  assert.match(shell, /href: experimentHref/);
  assert.match(shell, /href: "\/profile"/);
});

test("canonical learner shell is task-first and does not repeat screen guidance", () => {
  assert.doesNotMatch(shell, /canonical-mobile-guide/);
  assert.doesNotMatch(shell, /canonical-orientation/);
  assert.doesNotMatch(shell, /Screen guide/);
  assert.doesNotMatch(shell, /Your learning answers, Lab work and experiment entries stay in their proper places/);
});

test("canonical shell contains keyboard and motion hardening", () => {
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /trigger\?\.focus/);
  assert.match(shell, /Skip to current task/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("legacy learner chrome is suppressed only inside the canonical route shell", () => {
  assert.match(css, /\.canonical-shell \.prototype-topbar/);
  assert.match(css, /\.canonical-shell \.prototype-bottom-trigger/);
  assert.match(css, /\.canonical-shell \.habit-lab-route-header/);
});


test("learner navigation uses one centred Menu trigger and no top-right duplicate", () => {
  assert.match(shell, /className="canonical-menu-trigger"/);
  assert.doesNotMatch(shell, /canonical-topbar-menu/);
  assert.doesNotMatch(css, /canonical-shell:not\(\[data-stage="lab"\]\) \.canonical-menu-trigger/);
  assert.match(css, /\.canonical-menu-trigger\{display:flex!important\}/);
});
