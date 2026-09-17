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

test("canonical learner navigation preserves the accepted BIS journey", () => {
  for (const label of ["Today", "Learn", "Lab", "Experiment"]) {
    assert.ok(shell.includes(`label: \"${label}\"`), `${label} should remain in the canonical learner menu`);
  }
  assert.match(shell, /href: "\/habit"/);
  assert.match(shell, /href: "\/habit\?section=learn"/);
  assert.match(shell, /href: "\/habit-lab"/);
  assert.match(shell, /href: "\/habit-lab\/experiment"/);
});

test("canonical shell answers the five PD experience questions without deleting them on mobile", () => {
  for (const label of ["Where you are", "What this means", "Do now", "Next", "Need help?"]) {
    assert.ok(shell.includes(label), `${label} should remain visible in shell guidance`);
  }
  assert.match(shell, /canonical-mobile-guide/);
  assert.match(css, /\.canonical-mobile-guide\{display:none/);
  assert.match(css, /@media\(max-width:820px\).*\.canonical-mobile-guide\{display:block/s);
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
