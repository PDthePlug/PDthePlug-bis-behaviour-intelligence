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

test("Habit Lab and field experiment are compatibility aliases into the canonical Universal Lab surface", async () => {
  const [lab, experiment, layout, canonical] = await Promise.all([
    source("app/habit-lab/page.tsx"),
    source("app/habit-lab/experiment/page.tsx"),
    source("app/habit-lab/layout.tsx"),
    source("app/canonical-adaptive-shell.tsx"),
  ]);
  assert.match(lab, /\/labs\/hab/);
  assert.match(experiment, /\/labs\/hab/);
  assert.match(experiment, /step: "7"/);
  assert.doesNotMatch(lab, /HabitLabShell|HabitRouteBridge/);
  assert.doesNotMatch(experiment, /HabitLabShell|HabitRouteBridge/);
  assert.match(layout, /CanonicalAdaptiveShell/);
  for (const label of ["Today", "Learn", "Lab", "Experiment", "Profile"]) {
    assert.match(canonical, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(canonical, /canonical-topbar-menu/);
  assert.match(canonical, /className="canonical-menu-trigger"/);
  assert.match(canonical, /Open BIS menu · current area/);
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
  const [player, labPage, experimentPage] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/habit-lab/page.tsx"),
    source("app/habit-lab/experiment/page.tsx"),
  ]);

  assert.match(player, /function labHrefWithReturn\(href: string, returnTo: string\)/);
  assert.match(player, /const learningReturnTo = `\$\{pathname\}\?section=learn&page=\$\{selected \+ 1\}`/);
  assert.match(player, /const resolvedLabHref = universalLabHref \?\? moduleDefinition\?\.labHref/);
  assert.match(player, /labHrefWithReturn\(resolvedLabHref, learningReturnTo\)/);
  assert.match(labPage, /optionalSafeReturnPath\(params\.returnTo\)/);
  assert.match(labPage, /query\.set\("returnTo", returnTo\)/);
  assert.match(labPage, /\/labs\/hab/);
  assert.match(experimentPage, /optionalSafeReturnPath\(params\.returnTo\)/);
  assert.match(experimentPage, /new URLSearchParams\(\{ step: "7" \}\)/);
  assert.match(experimentPage, /query\.set\("returnTo", returnTo\)/);
  assert.match(experimentPage, /\/labs\/hab/);
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
  const [auth, habit, decision, money, universal] = await Promise.all([
    source("lib/auth-redirect.ts"),
    source("app/habit-lab/page.tsx"),
    source("app/decision/page.tsx"),
    source("app/money/page.tsx"),
    source("app/labs/[code]/page.tsx"),
  ]);

  assert.match(auth, /optionalSafeReturnPath/);
  assert.match(habit, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(decision, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(money, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(universal, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  for (const route of [habit, decision, money, universal]) {
    assert.match(route, /requireUser\(next\)/);
  }
});


test("Programme Player discovers active source-backed Universal Labs without bespoke catalogue wiring", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(await source("lib/learning-lab-runtime.mjs"), /\/api\/universal-lab\?lab=/);
  assert.match(player, /loadLearningLabRuntime\(moduleCode/);
  assert.match(player, /const universalLabHref = moduleRuntime\?\.runtimeMode === "DYNAMIC"/);
  assert.match(player, /const resolvedLabHref = universalLabHref \?\? moduleDefinition\?\.labHref/);
  assert.match(player, /labHrefWithReturn\(resolvedLabHref, learningReturnTo\)/);
});

test("Programme experiment status is authored-window aware instead of assuming seven days", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /const experimentTotalDays = programmeHandoff\?\.totalDays \|\| 7/);
  assert.match(player, /const experimentRecordedDays =/);
  assert.match(player, /programmeHandoff\?\.evidenceDaysRecorded/);
  assert.match(player, /Experiment Day \{experimentDay\} of \{experimentTotalDays\}/);
  assert.match(player, /programmeHandoff\?\.evidenceWindowCount/);
  assert.match(player, /weekly entries/);
  assert.match(player, /observation days/);
  assert.doesNotMatch(player, /activeModuleRuntime\.events\.length\}\/7 observation days recorded/);
});


test("Today makes unrecorded Investigation 7 evidence the primary learner action", async () => {
  const [player, css] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/learning/programme-player.css"),
  ]);

  assert.match(player, /programmeHandoff\.currentDay > 0/);
  assert.match(player, /!programmeHandoff\.todayEvidenceRecorded/);
  assert.match(player, /Today’s Lab evidence · Investigation 7/);
  assert.match(player, /Capture today’s evidence/);
  assert.match(player, /Tomorrow’s evidence opens tomorrow/);
  assert.match(player, /an unrecorded past day remains missing evidence/);
  assert.match(css, /\.prototype-evidence-due\{/);
  assert.match(css, /grid-column:1\/-1/);
});
