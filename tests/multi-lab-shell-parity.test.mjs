import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const frame = readFileSync("app/lab-investigation-frame.tsx", "utf8");
const frameCss = readFileSync("app/lab-investigation-frame.css", "utf8");
const universalPlayer = readFileSync("app/labs/[code]/universal-runtime-lab.tsx", "utf8");
const universalApi = readFileSync("app/api/universal-lab/route.ts", "utf8");
const decisionPage = readFileSync("app/decision/page.tsx", "utf8");
const moneyPage = readFileSync("app/money/page.tsx", "utf8");
const habitPage = readFileSync("app/habit-lab/page.tsx", "utf8");
const experimentPage = readFileSync("app/habit-lab/experiment/page.tsx", "utf8");
const coreLegacyApi = readFileSync("app/api/labs/route.ts", "utf8");
const habitLegacyApi = readFileSync("app/api/bis/route.ts", "utf8");

test("Habit Decision and Money all terminate in the same Universal Lab route family", () => {
  assert.match(habitPage, /\/labs\/hab/);
  assert.match(decisionPage, /\/labs\/dec/);
  assert.match(moneyPage, /\/labs\/mon/);
  assert.match(experimentPage, /\/labs\/hab/);
  assert.match(experimentPage, /step: "7"/);

  for (const source of [habitPage, decisionPage, moneyPage, experimentPage]) {
    assert.doesNotMatch(source, /HabitLabShell|CoreLabExperience|liveUniversalLabHref/);
  }
});

test("one universal investigation frame owns progress navigation and mission presentation", () => {
  assert.match(frame, /export function LabInvestigationFrame/);
  assert.match(frame, /export function LabMissionHeader/);
  assert.match(frame, /universal-lab-progress/);
  assert.match(frame, /universal-investigation-nav/);
  assert.match(frame, /universal-lab-mission/);
  assert.match(frame, /investigation\.produces/);
  assert.match(frame, /investigation\.difficulty/);
});

test("the Universal Runtime Lab is the only learner Lab player for all governed codes", () => {
  assert.match(universalPlayer, /export function UniversalRuntimeLab/);
  assert.match(universalPlayer, /<LabInvestigationFrame/);
  assert.match(universalPlayer, /labCode/);
  assert.match(universalPlayer, /\/api\/universal-lab/);
  assert.doesNotMatch(universalPlayer, /CoreLabExperience|HabitLabShell/);
});

test("universal Lab CSS defines one mobile grammar for every Lab", () => {
  assert.match(frameCss, /\.universal-lab-progress/);
  assert.match(frameCss, /\.universal-investigation-nav/);
  assert.match(frameCss, /\.universal-lab-stage/);
  assert.match(frameCss, /\.universal-lab-mission/);
  assert.match(frameCss, /@media\(max-width:820px\)/);
  assert.match(frameCss, /@media\(max-width:430px\)/);
  assert.match(frameCss, /prefers-reduced-motion/);
});

test("Universal runtime keeps evidence namespaced by the requested Lab code", () => {
  assert.match(universalApi, /target_code: code/);
  assert.match(universalApi, /eq\(labEnrollments\.labCode, code\)/);
  assert.match(universalApi, /eq\(responses\.labCode, code\)/);
  assert.match(universalApi, /runtime\.definition/);
});

test("retired dedicated APIs cannot keep writing after Dynamic activation", () => {
  assert.match(coreLegacyApi, /legacyLabGuard/);
  assert.match(habitLegacyApi, /legacyLabGuard\("HAB"/);
});

test("Universal navigation uses the returned server snapshot as progression authority", () => {
  assert.match(universalPlayer, /serverUnlockedInvestigation/);
  assert.match(universalPlayer, /snapshot\.enrolment/);
  assert.match(universalPlayer, /currentInvestigation/);
  assert.match(universalPlayer, /params\.set\("step"/);
  assert.match(universalPlayer, /router\.push|router\.replace/);
});
