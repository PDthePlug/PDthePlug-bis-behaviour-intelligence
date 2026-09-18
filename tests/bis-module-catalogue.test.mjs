import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("BIS catalogue defines exactly 32 current modules across 12 + 12 + 8", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  assert.equal(catalogue.productScope, 32);
  assert.equal(catalogue.modules.length, 32);
  assert.deepEqual(
    catalogue.volumes.map((volume) => [volume.volume, volume.count]),
    [[1, 12], [2, 12], [3, 8]],
  );
  assert.equal(catalogue.modules.filter((item) => item.volume === 1).length, 12);
  assert.equal(catalogue.modules.filter((item) => item.volume === 2).length, 12);
  assert.equal(catalogue.modules.filter((item) => item.volume === 3).length, 8);
});

test("catalogue identities and positions are unique and continuous", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  const codes = catalogue.modules.map((item) => item.code);
  const slugs = catalogue.modules.map((item) => item.slug);
  const globals = catalogue.modules.map((item) => item.global);
  assert.equal(new Set(codes).size, 32);
  assert.equal(new Set(slugs).size, 32);
  assert.equal(new Set(globals).size, 32);
  assert.deepEqual(globals, Array.from({ length: 32 }, (_, index) => index + 1));
});

test("current 32-module scope preserves the sourced volume sequence", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  assert.deepEqual(
    catalogue.modules.filter((m) => m.volume === 1).map((m) => m.title),
    [
      "Habit Lab™", "Decision Lab™", "Money Lab™", "Identity Lab™", "Attention Lab™",
      "Time Lab™", "Risk Lab™", "Trust Lab™", "Influence Lab™", "Leadership Lab™",
      "Purpose Lab™", "Resilience Lab™",
    ],
  );
  assert.deepEqual(
    catalogue.modules.filter((m) => m.volume === 2).map((m) => m.title),
    [
      "Career Lab™", "Launch Lab™", "Failure Lab™", "Growth Mindset Lab™", "Grit Lab™",
      "Entrepreneurship Lab™", "Negotiation Lab™", "Team Lab™", "Ethics Lab™",
      "Future Self Lab™", "Opportunity Lab™", "Communication Lab™",
    ],
  );
  assert.deepEqual(
    catalogue.modules.filter((m) => m.volume === 3).map((m) => m.title),
    [
      "Systems Thinking™ Lab", "Long-Term Thinking™ Lab", "Economics for Humans™ Lab",
      "Customer Thinking™ Lab", "Innovation Thinking™ Lab", "Asset Thinking™ Lab",
      "Financial Philosophy™ Lab", "Personal Effectiveness™ Lab",
    ],
  );
});

test("a live catalogue surface always has a real route", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  for (const item of catalogue.modules) {
    if (item.learningStatus === "live") assert.ok(item.learningHref, `${item.code} learning route`);
    if (item.labStatus === "live") assert.ok(item.labHref, `${item.code} Lab route`);
  }
  assert.deepEqual(
    catalogue.modules.filter((m) => m.labStatus === "live").map((m) => m.code),
    ["HAB", "DEC", "MON"],
  );
});

test("Volume 1 digital sources 2-5 are represented as source-ready, not falsely live", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  for (const code of ["DEC", "MON", "IDN", "ATT"]) {
    const entry = catalogue.modules.find((item) => item.code === code);
    assert.equal(entry?.learningStatus, "source_ready");
    assert.equal(entry?.learningHref, null);
  }
});

test("handbook and Lab libraries render from the same catalogue", async () => {
  const component = await source("app/catalogue/module-library.tsx");
  const learnPage = await source("app/learn/page.tsx");
  const labsPage = await source("app/labs/page.tsx");
  assert.match(component, /BIS_MODULES/);
  assert.match(component, /BIS_VOLUMES/);
  assert.match(component, /mode === "learning"/);
  assert.match(component, /mode === "lab"/);
  assert.match(learnPage, /<ModuleLibrary mode="learning" \/>/);
  assert.match(labsPage, /<ModuleLibrary mode="lab" \/>/);
});

test("module template freezes three editions and the 13-position handbook pattern", async () => {
  const contract = await source("lib/bis-catalogue.ts");
  assert.match(contract, /"school", "emerging_adult", "workplace"/);
  for (const position of ["Welcome", "Day 1", "Day 3", "Weekend", "Day 10", "Certificate"]) {
    assert.ok(contract.includes(`"${position}"`), `${position} is required`);
  }
  assert.match(contract, /handoffProgrammeDay:\s*3/);
  assert.match(contract, /programmeStep:.*PROGRAMME/);
  assert.match(contract, /workbookResponse:.*WB/);
});

test("future source candidates remain outside the current 32 until explicitly promoted", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  assert.deepEqual(
    catalogue.futureSourceCandidates.map((item) => item.title),
    ["Transferable Skills™ Lab", "Meta-Learning™ Lab"],
  );
  for (const candidate of catalogue.futureSourceCandidates) {
    assert.equal(catalogue.modules.some((item) => item.title === candidate.title), false);
  }
});
