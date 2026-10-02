import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("BIS template defines Day 3 as the standard Lab handover day", async () => {
  const catalogue = await source("lib/bis-catalogue.ts");
  const compiler = await source("lib/content-compiler.ts");

  assert.match(catalogue, /handoffProgrammeDay:\s*3/);
  assert.match(compiler, /if \(key === "Day 3"\) return "LAB"/);
});

test("every live learning module renders a Day 3 Lab handover from catalogue state", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /BIS_MODULE_TEMPLATE\.handoffProgrammeDay/);
  assert.match(player, /moduleDefinition\?\.labStatus === "live"/);
  assert.match(player, /ProgrammeLabHandoff/);
  assert.match(player, /DAY 3 · LAB HANDOVER/);
  assert.match(player, /legacyDayThreeBoundary/);
  assert.match(player, /Lab source ready/);
  assert.match(player, /Lab access not yet enabled/);
  assert.doesNotMatch(player, /Planned Lab/);
  assert.doesNotMatch(player, /Day 3 is still the Lab handover point in this programme/);

  assert.doesNotMatch(
    player,
    /moduleCode !== "HAB" && page\.key === "Day 3" \? <p className="handbook-learning-note"/,
  );
});

test("live Decision and Money Labs are available to the standard Day 3 handover", async () => {
  const raw = JSON.parse(await source("lib/bis-catalogue.json"));
  const byCode = Object.fromEntries(raw.modules.map((item) => [item.code, item]));

  assert.equal(byCode.HAB.labStatus, "live");
  assert.equal(byCode.HAB.labHref, "/habit-lab");
  assert.equal(byCode.DEC.labStatus, "live");
  assert.equal(byCode.DEC.labHref, "/decision");
  assert.equal(byCode.MON.labStatus, "live");
  assert.equal(byCode.MON.labHref, "/money");
  assert.equal(byCode.IDN.labStatus, "source_ready");
  assert.equal(byCode.ATT.labStatus, "source_ready");
  assert.equal(raw.modules.filter((item) => item.labStatus === "source_ready").length, 30);
  assert.equal(byCode.FAI.labStatus, "planned");
});

test("live core Labs preserve a safe return path back to Day 3 learning", async () => {
  const lab = await source("app/core-lab-experience.tsx");

  assert.match(lab, /searchParams\.get\("returnTo"\)/);
  assert.match(lab, /requestedReturnTo\.startsWith\("\/"\)/);
  assert.match(lab, /!requestedReturnTo\.startsWith\("\/\/"\)/);
  assert.match(lab, /Back to learning/);
  assert.match(lab, /Return to your learning module/);
});

test("learner menu never routes another module into the Habit experiment by accident", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /moduleCode === "HAB" \? \(/);
  assert.match(player, /Practice/);
  assert.match(player, /Continue the live Lab/);
  assert.doesNotMatch(
    player,
    /<Link href="\/habit-lab\/experiment\?returnTo=%2Fhabit">/,
  );
});

test("post-Lab programme completion stays locked until the first Investigation 7 evidence handback", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /const labSequenceLocked =/);
  assert.match(player, /selected >= dayThreeIndex/);
  assert.match(player, /programmeHandoff && programmeHandoff\.evidenceDaysRecorded > 0/);
  assert.match(player, /activeModuleRuntime\?\.experiment && activeModuleRuntime\.events\.length > 0/);
  assert.match(player, /Reference view/);
  assert.match(player, /programme progress resumes after that Lab handback/);
  assert.match(player, /disabled=\{saving \|\| completing \|\| labSequenceLocked\}/);
  assert.match(player, /disabled=\{completing \|\| \(labSequenceLocked && selected > dayThreeIndex\)\}/);
  assert.match(player, /Continue after the Lab/);
});


test("the compiler manufactures the Day 3 Lab handover when books do not contain digital anchors", async () => {
  const compiler = await source("lib/content-compiler.ts");

  assert.match(compiler, /ensureDigitalLabHandoff/);
  assert.match(compiler, /data-bis-lab-handoff="start"/);
  assert.match(compiler, /data-bis-lab-handoff="end"/);
  assert.match(compiler, /source: "COMPILER"/);
  assert.match(compiler, /dayThree\.html\.includes\(dayThree\.labHandoff\.startMarker\)/);
  assert.match(compiler, /dayThree\.html\.includes\(dayThree\.labHandoff\.endMarker\)/);
  assert.doesNotMatch(compiler, /must include authored labHandoff/);
});

test("source-ready Labs use a restrained Day 3 bridge without pretending the Lab does not exist", async () => {
  const [player, css] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/learning/programme-player.css"),
  ]);

  assert.match(player, /\$\{title\} connects here/);
  assert.match(player, /Lab source ready/);
  assert.match(player, /Lab access not yet enabled/);
  assert.doesNotMatch(player, /Planned Lab/);
  assert.match(css, /\.prototype-lab-handoff\.planned\{background:#f6f3eb/);
  assert.match(css, /\.prototype-lab-handoff\.planned \.prototype-lab-status/);
});


test("legacy Decision and Money Day 3 platform preambles are removed before learner rendering", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /stripLegacyDayThreePlatformPreamble/);
  assert.match(player, /EXISTING\\s\+BIS\\s\+LAB\\s\+PLATFORM/);
  assert.match(player, /DAY 3 OF 10/);
  assert.match(player, /const html = stripLegacyDayThreePlatformPreamble\(page\.html\)/);
});
