import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Time remains catalogued but closed until governed learning and Lab publications exist", async () => {
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  const time = catalogue.modules.find((item) => item.code === "TIM");

  assert.ok(time);
  assert.equal(time.global, 6);
  assert.equal(time.volume, 1);
  assert.equal(time.position, 6);
  assert.equal(time.slug, "time");
  assert.equal(time.title, "Time Lab™");
  assert.equal(time.learningStatus, "catalogued");
  assert.equal(time.learningHref, null);
  assert.equal(time.labStatus, "source_ready");
  assert.equal(time.labHref, null);
});

test("the generic handbook route can host Time without a bespoke Time page", async () => {
  const route = await source("app/handbooks/[code]/page.tsx");

  assert.match(route, /<ProgrammeEntry/);
  assert.match(route, /moduleCode=\{code\.toUpperCase\(\)\}/);
  assert.doesNotMatch(route, /code === "tim"/i);
  assert.doesNotMatch(route, /TIM/);
});

test("learning availability remains publication-driven rather than catalogue-driven", async () => {
  const route = await source("app/api/learning/route.ts");

  assert.match(route, /contentLibraryItems\.kind/);
  assert.match(route, /eq\(contentLibraryItems\.status, "ACTIVE"\)/);
  assert.match(route, /contentReleases\.status/);
  assert.match(route, /"PUBLISHED"/);
  assert.match(route, /"CONTROLLED"/);
});
