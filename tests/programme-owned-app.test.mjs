import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("authenticated root and auth defaults enter the Habit programme", async () => {
  const [home, signIn, callback] = await Promise.all([
    source("app/page.tsx"),
    source("app/sign-in/page.tsx"),
    source("app/auth/callback/route.ts"),
  ]);
  assert.match(home, /redirect\("\/habit"\)/);
  assert.match(home, /view === "lab"[\s\S]*redirect\("\/habit-lab"\)/);
  assert.match(home, /view === "experiment"[\s\S]*redirect\("\/habit-lab\/experiment"\)/);
  assert.match(signIn, /: "\/habit"/);
  assert.match(callback, /: "\/habit"/);
});

test("Habit programme owns learner setup without forcing the formal baseline before Day 1", async () => {
  const entry = await source("app/habit/programme-entry.tsx");
  assert.match(entry, /return <ProgrammePlayer \/>/);
  assert.match(entry, /action: "setup"/);
  assert.doesNotMatch(entry, /BaselineScreen/);
  assert.match(entry, /Learn the pattern first\. Investigate it on Day 3/);
});

test("Habit Lab and field experiment are focused child routes", async () => {
  const [lab, experiment, shell] = await Promise.all([
    source("app/habit-lab/page.tsx"),
    source("app/habit-lab/experiment/page.tsx"),
    source("app/habit-lab/habit-lab-shell.tsx"),
  ]);
  assert.match(lab, /view="lab"/);
  assert.match(experiment, /view="experiment"/);
  assert.match(shell, /href="\/habit"/);
  assert.match(shell, /HabitRouteBridge target=\{view\}/);
});

test("programme tools are presented through the hamburger drawer rather than a horizontal toolbar", async () => {
  const css = await source("app/learning/programme-owner.css");
  assert.match(css, /\.programme-menu\{display:grid!important/);
  assert.match(css, /\.programme-rail\.open~\.programme-main \.programme-tabs/);
  assert.match(css, /grid-template-columns:1fr!important/);
  assert.match(css, /\.programme-main\{margin-left:0!important/);
});

test("legacy learning URLs collapse back into the active programme", async () => {
  const [learning, legacyHabit] = await Promise.all([
    source("app/learning/page.tsx"),
    source("app/learning/[lab]/page.tsx"),
  ]);
  assert.match(learning, /redirect\("\/habit"\)/);
  assert.match(legacyHabit, /redirect\("\/habit"\)/);
});
