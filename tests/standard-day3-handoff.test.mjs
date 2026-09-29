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
  assert.match(player, /Day 3 is still the Lab handover point in this programme/);
  assert.match(player, /Lab coming soon/);

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
  assert.equal(byCode.IDN.labStatus, "planned");
  assert.equal(byCode.ATT.labStatus, "planned");
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

test("post-Lab programme completion stays locked until Phase A really exists", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /const labSequenceLocked =/);
  assert.match(player, /selected >= dayThreeIndex/);
  assert.match(player, /activeModuleRuntime\?\.enrolment\?\.phaseACompletedAt/);
  assert.match(player, /Reference view/);
  assert.match(player, /programme progress resumes after the Lab/);
  assert.match(player, /disabled=\{saving \|\| completing \|\| labSequenceLocked\}/);
  assert.match(player, /disabled=\{completing \|\| \(labSequenceLocked && selected > dayThreeIndex\)\}/);
  assert.match(player, /Lab coming soon/);
});
