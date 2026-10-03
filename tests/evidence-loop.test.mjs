import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Phase B exposes a deterministic handback from experiment to review to portfolio", async () => {
  const [universalRoute, habitRoute, runtime, habitRuntime, programme] = await Promise.all([
    source("app/api/universal-lab/route.ts"),
    source("app/api/bis/route.ts"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("app/bis-app.tsx"),
    source("app/learning/programme-player.tsx"),
  ]);

  for (const file of [universalRoute, habitRoute]) {
    assert.match(file, /reviewReady/);
    assert.match(file, /labCompleted/);
    assert.match(file, /portfolioReady/);
    assert.match(file, /nextAction/);
  }

  assert.match(runtime, /router\.replace\(programmeReturnTo\)/);
  assert.match(habitRuntime, /onReviewReady=\{\(\) => \{ setStep\(8\)/);
  assert.match(habitRuntime, /updated && programmeReturnTo/);
  assert.match(programme, /Phase B complete · Evidence Review/);
  assert.match(programme, /View my evidence portfolio/);
  assert.match(programme, /Review my evidence/);
});

test("learner portfolio is built from evidence and measurements without returning private response wording", async () => {
  const [route, profile] = await Promise.all([
    source("app/api/evidence-portfolio/route.ts"),
    source("app/profile/profile-dashboard.tsx"),
  ]);

  assert.match(route, /evidenceRecords/);
  assert.match(route, /measurementValues/);
  assert.match(route, /measurementSources/);
  assert.doesNotMatch(route, /responses/);
  assert.match(route, /originalResponsesIncluded: false/);
  assert.match(profile, /Your evidence portfolio/);
  assert.match(profile, /evidence anchors/);
  assert.match(profile, /calculated measures/);
});
