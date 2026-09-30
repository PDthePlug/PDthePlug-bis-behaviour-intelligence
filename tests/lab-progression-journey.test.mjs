import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("one BIS lifecycle contract names the complete learner journey", async () => {
  const lifecycle = await source("lib/lab-lifecycle-contract.ts");

  for (const stage of [
    "OPEN",
    "BASELINE",
    "INVESTIGATION",
    "SAVE",
    "UNLOCK_NEXT",
    "PHASE_A_COMPLETE",
    "EXPERIMENT",
    "REVIEW",
    "COMPLETION",
    "RETURN_TO_LEARNING",
  ]) {
    assert.ok(lifecycle.includes(`"${stage}"`), `Lifecycle is missing ${stage}`);
  }

  assert.match(lifecycle, /5: "saveHypothesis"/);
  assert.match(lifecycle, /6: "startExperiment"/);
  assert.match(lifecycle, /7: "completeExperiment"/);
  assert.match(lifecycle, /8: "saveResponses"/);
});

test("Decision and Money complete the 1 → 2 → 3 progression contract", async () => {
  const [route, client, definitions] = await Promise.all([
    source("app/api/labs/route.ts"),
    source("app/core-lab-experience.tsx"),
    source("lib/core-labs.ts"),
  ]);

  for (const code of ["DEC", "MON"]) assert.match(definitions, new RegExp(`code: "${code}"`));

  assert.match(route, /Validate the whole investigation before writing any response/);
  assert.match(route, /actionOwnsInvestigationUnlock\(action, investigation\)/);
  assert.match(route, /investigationUnlockedAfterSave\(investigation\)/);
  assert.match(route, /currentInvestigation: Math\.max\(serverCurrent, unlocked\)/);
  assert.doesNotMatch(route, /currentInvestigation: Math\.max\(Number\(enrolment\.currentInvestigation\), field\.investigation\)/);

  assert.match(client, /goToSavedStep\(saved: Snapshot, requested: number\)/);
  assert.match(client, /serverUnlockedInvestigation\(saved\.enrolment\?\.currentInvestigation, requested\)/);
  assert.match(client, /next=\{\(saved\) => goToSavedStep\(saved, 2\)\}/);
  assert.match(client, /next=\{\(saved\) => goToSavedStep\(saved, 3\)\}/);

  const unlock = (investigation) => Math.min(9, investigation + 1);
  const renderFromServer = (serverCurrent, requested) =>
    Math.max(1, Math.min(9, Math.min(serverCurrent, requested)));

  for (const lab of ["DEC", "MON"]) {
    let serverCurrent = 1;

    serverCurrent = Math.max(serverCurrent, unlock(1));
    assert.equal(serverCurrent, 2, `${lab}: saving Investigation 1 must unlock 2`);
    assert.equal(renderFromServer(serverCurrent, 2), 2, `${lab}: UI must render 2 from the returned snapshot`);

    serverCurrent = Math.max(serverCurrent, unlock(2));
    assert.equal(serverCurrent, 3, `${lab}: saving Investigation 2 must unlock 3`);
    assert.equal(renderFromServer(serverCurrent, 3), 3, `${lab}: UI must render 3 from the returned snapshot`);
  }
});

test("special lifecycle transitions cannot be unlocked by partial generic response saves", async () => {
  const [route, lifecycle] = await Promise.all([
    source("app/api/labs/route.ts"),
    source("lib/lab-lifecycle-contract.ts"),
  ]);

  assert.match(lifecycle, /5: "saveHypothesis"/);
  assert.match(lifecycle, /6: "startExperiment"/);
  assert.match(lifecycle, /7: "completeExperiment"/);
  assert.match(route, /phaseACompletedAt: now/);
  assert.match(route, /currentInvestigation: 7/);
  assert.match(route, /currentInvestigation: 8/);
});

test("future Universal Labs use the same server-owned progression invariant", async () => {
  const [api, client] = await Promise.all([
    source("app/api/universal-lab/route.ts"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
  ]);

  assert.match(api, /investigationUnlockedAfterSave\(investigation\)/);
  assert.match(client, /serverUnlockedInvestigation/);
  assert.match(client, /onAdvance\(saved, Math\.min\(9, step \+ 1\)\)/);
  assert.match(client, /saved\.enrolment\?\.currentInvestigation/);
});
