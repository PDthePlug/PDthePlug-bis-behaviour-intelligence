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
  assert.match(signIn, /safeReturnPath\(params\.next\)/);
  assert.match(callback, /safeReturnPath\(url\.searchParams\.get\("next"\)\)/);
});

test("learner profile setup opens the prototype-derived BIS shell without forcing the formal baseline", async () => {
  const [entry, habitPage] = await Promise.all([
    source("app/habit/programme-entry.tsx"),
    source("app/habit/page.tsx"),
  ]);
  assert.match(entry, /initialLearnMode=\{initialLearnMode\}/);
  assert.match(entry, /action: "setup"/);
  assert.doesNotMatch(entry, /BaselineScreen/);
  assert.match(entry, /Tell BIS a little about how you are learning/);
  assert.match(entry, /Your age band helps us show the right learning material/);
  assert.doesNotMatch(entry, /Your classification is stored once/);
  assert.match(habitPage, /params\.section === "learn" \? "learn" : "today"/);
});

test("Habit Lab and field experiment are focused child surfaces under the canonical BIS learner menu", async () => {
  const [lab, experiment, shell, layout, canonical] = await Promise.all([
    source("app/habit-lab/page.tsx"),
    source("app/habit-lab/experiment/page.tsx"),
    source("app/habit-lab/habit-lab-shell.tsx"),
    source("app/habit-lab/layout.tsx"),
    source("app/canonical-adaptive-shell.tsx"),
  ]);
  assert.match(lab, /view="lab"/);
  assert.match(experiment, /view="experiment"/);
  assert.match(shell, /HabitRouteBridge target=\{view\} hideReturnLink/);
  assert.doesNotMatch(shell, /FocusedLearnerMenu/);
  assert.match(layout, /CanonicalAdaptiveShell/);
  for (const label of ["Today", "Learn", "Lab", "Experiment", "Profile"]) {
    assert.match(canonical, new RegExp(`label: "${label}"`));
  }
  assert.match(canonical, /canonical-topbar-menu/);
  assert.match(canonical, /stage === "lab"/);
  assert.match(canonical, /className="canonical-menu-trigger"/);
});

test("learning player keeps its focused navigation while Lab restores the convenient centre Menu", async () => {
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

test("Learn owns the shared 34-handbook catalogue while Habit owns its selected programme map", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const library = await source("app/catalogue/module-library.tsx");
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  assert.equal(catalogue.modules.length, 34);
  assert.match(library, /BIS_MODULES/);
  assert.match(player, /prototype-programme-map/);
  assert.match(player, /href="\/learn"/);
  assert.doesNotMatch(library, /Learner profile context/);
  assert.doesNotMatch(library, /Workplace Edition/);
});

test("handbook assets are loaded from the deployed filesystem rather than self-fetching a protected preview", async () => {
  const assetRoute = await source("app/programmes/[asset]/route.ts");
  assert.match(assetRoute, /readFile\(path\.join\(process\.cwd\(\), "public", relativePath\)/);
  assert.match(assetRoute, /export const runtime = "nodejs"/);
  assert.doesNotMatch(assetRoute, /fetch\(new URL\(path, origin\)/);
});

test("legacy learning URLs collapse into the Learn surface", async () => {
  const [learning, legacyHabit] = await Promise.all([
    source("app/learning/page.tsx"),
    source("app/learning/[lab]/page.tsx"),
  ]);
  assert.match(learning, /redirect\("\/learn"\)/);
  assert.match(legacyHabit, /redirect\("\/learn"\)/);
});


test("Day 3 Lab handoff preserves the exact learner handbook return path", async () => {
  const [player, labPage, experimentPage, shell] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/habit-lab/page.tsx"),
    source("app/habit-lab/experiment/page.tsx"),
    source("app/habit-lab/habit-lab-shell.tsx"),
  ]);

  assert.match(player, /function labHrefWithReturn\(href: string, returnTo: string\)/);
  assert.match(player, /const learningReturnTo = `\$\{pathname\}\?section=learn&page=\$\{selected \+ 1\}`/);
  assert.match(player, /labHrefWithReturn\(moduleDefinition\.labHref, learningReturnTo\)/);
  assert.match(labPage, /returnTo=\{params\.returnTo\}/);
  assert.match(experimentPage, /returnTo=\{params\.returnTo\}/);
  assert.match(shell, /programmeReturnTo=\{safeReturnTo\}/);
});


test("Day 3 continuation unlocks only after Investigation 7 has captured real evidence", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /const labExperimentStarted =/);
  assert.match(player, /const labHandoffComplete =/);
  assert.match(player, /activeModuleRuntime\?\.experiment && activeModuleRuntime\.events\.length > 0/);
  assert.match(player, /!labHandoffComplete/);
  assert.match(player, /Record today’s Investigation 7 evidence/);
  assert.match(player, /Save today’s finding in the Lab and BIS will return you here to finish Day 3/);
});


test("Lab entry routes preserve the programme return path even when sign-in is required", async () => {
  const [auth, habitShell, decision, money, universal] = await Promise.all([
    source("lib/auth-redirect.ts"),
    source("app/habit-lab/habit-lab-shell.tsx"),
    source("app/decision/page.tsx"),
    source("app/money/page.tsx"),
    source("app/labs/[code]/page.tsx"),
  ]);

  assert.match(auth, /optionalSafeReturnPath/);
  assert.match(habitShell, /returnTo=\$\{encodeURIComponent\(safeReturnTo\)\}/);
  assert.match(decision, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(money, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(universal, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  for (const route of [habitShell, decision, money, universal]) {
    assert.match(route, /requireUser\(next\)/);
  }
});
