import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("authenticated root and auth defaults resolve through BIS role routing", async () => {
  const [home, router, signIn, callback] = await Promise.all([
    source("app/page.tsx"),
    source("app/role-router.tsx"),
    source("app/sign-in/page.tsx"),
    source("app/auth/callback/route.ts"),
  ]);
  assert.match(home, /<RoleRouter \/>/);
  assert.match(home, /view === "lab"[\s\S]*redirect\("\/habit-lab"\)/);
  assert.match(home, /view === "experiment"[\s\S]*redirect\("\/habit-lab\/experiment"\)/);
  assert.match(router, /SYSTEM_ADMIN/);
  assert.match(router, /FACILITATOR/);
  assert.match(router, /SAFEGUARDING_OFFICER/);
  assert.match(router, /staff \? "\/workspace" : "\/habit"/);
  assert.match(signIn, /: "\/"/);
  assert.match(callback, /: "\/"/);
});

test("learner profile setup opens the prototype-derived BIS shell without forcing the formal baseline", async () => {
  const [entry, habitPage] = await Promise.all([
    source("app/habit/programme-entry.tsx"),
    source("app/habit/page.tsx"),
  ]);
  assert.match(entry, /<ProgrammePlayer initialSection=\{initialSection\} \/>/);
  assert.match(entry, /action: "setup"/);
  assert.doesNotMatch(entry, /BaselineScreen/);
  assert.match(entry, /One profile determines the right handbook edition across BIS/);
  assert.match(habitPage, /params\.section === "learn" \? "learn" : "today"/);
});

test("Habit Lab and field experiment are focused child surfaces under the same bottom BIS menu", async () => {
  const [lab, experiment, shell, menu, focusedCss] = await Promise.all([
    source("app/habit-lab/page.tsx"),
    source("app/habit-lab/experiment/page.tsx"),
    source("app/habit-lab/habit-lab-shell.tsx"),
    source("app/habit-lab/focused-learner-menu.tsx"),
    source("app/habit-lab/focused-runtime.css"),
  ]);
  assert.match(lab, /view="lab"/);
  assert.match(experiment, /view="experiment"/);
  assert.match(shell, /HabitRouteBridge target=\{view\} hideReturnLink/);
  assert.match(shell, /<FocusedLearnerMenu active=\{view\} \/>/);
  assert.match(menu, /<strong>Today<\/strong>/);
  assert.match(menu, /<strong>Learn<\/strong>/);
  assert.match(menu, /<strong>Lab<\/strong>/);
  assert.match(menu, /<strong>Experiment<\/strong>/);
  assert.match(focusedCss, /\.habit-lab-route \.sidebar[\s\S]*display:none!important/);
  assert.match(focusedCss, /\.habit-lab-route \.mobile-task-dock/);
});

test("learner application has one bottom hamburger navigation rather than a menu inside a menu", async () => {
  const [player, css, layout] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/learning/programme-player.css"),
    source("app/layout.tsx"),
  ]);
  assert.match(player, /prototype-bottom-trigger/);
  assert.match(player, /prototype-bottom-sheet/);
  assert.match(player, /<strong>Today<\/strong>/);
  assert.match(player, /<strong>Learn<\/strong>/);
  assert.match(player, /<strong>Lab<\/strong>/);
  assert.match(player, /<strong>Experiment<\/strong>/);
  assert.doesNotMatch(player, /programme-tabs/);
  assert.doesNotMatch(player, /programme-rail/);
  assert.match(css, /\.prototype-bottom-trigger\{/);
  assert.match(css, /\.prototype-bottom-sheet\{/);
  assert.doesNotMatch(layout, /programme-owner\.css/);
});

test("Learn owns profile classification, the five-handbook library and contextual programme map", async () => {
  const player = await source("app/learning/programme-player.tsx");
  for (const label of ["Habit Lab™", "Decision Lab™", "Money Lab™", "Identity Lab™", "Attention Lab™"]) {
    assert.match(player, new RegExp(label));
  }
  assert.match(player, /deliveryEdition/);
  assert.match(player, /prototype-handbook-grid/);
  assert.match(player, /prototype-programme-map/);
  assert.match(player, /The edition is already resolved from your persisted BIS learner profile/);
});

test("legacy learning URLs collapse into the Learn surface", async () => {
  const [learning, legacyHabit] = await Promise.all([
    source("app/learning/page.tsx"),
    source("app/learning/[lab]/page.tsx"),
  ]);
  assert.match(learning, /redirect\("\/habit\?section=learn"\)/);
  assert.match(legacyHabit, /redirect\("\/habit\?section=learn"\)/);
});
