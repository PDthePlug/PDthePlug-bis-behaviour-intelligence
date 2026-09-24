import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("every learning version is a three-edition release", async () => {
  const [compiler, api, ui, docs] = await Promise.all([
    source("lib/content-compiler.ts"),
    source("app/api/content-studio/route.ts"),
    source("app/content-studio/content-studio.tsx"),
    source("docs/CONTENT_COMPILER_RUNTIME.md"),
  ]);
  assert.match(compiler, /LEARNING_EDITION_KEYS = \[\.\.\.DELIVERY_EDITIONS\]/);
  for (const edition of ["school", "emerging_adult", "workplace"]) {
    assert.ok(api.includes(edition));
    assert.ok(ui.includes(edition));
    assert.ok(docs.includes(edition));
  }
  assert.match(api, /Every learning module has three editions/);
  assert.match(api, /Activation blocked: missing compiled editions/);
  assert.match(ui, /Three editions travel together/);
  assert.match(ui, /BIS will not publish a partial edition set/);
});

test("learning compiler preserves the canonical 13-position Programme Player contract", async () => {
  const compiler = await source("lib/content-compiler.ts");
  for (const key of ["Welcome", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Weekend", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Certificate"]) {
    assert.ok(compiler.includes('"' + key + '"'));
  }
  assert.match(compiler, /every BIS learning edition must contain all 13 programme positions/);
  assert.match(compiler, /PROGRAMME/);
  assert.match(compiler, /workbook fields must stay inside/);
  assert.match(compiler, /data-purpose="LEARNING_RESPONSE"/);
  assert.match(compiler, /executable HTML is not allowed/);
});

test("compiler emits immutable runtime artifacts and activation pointers", async () => {
  const [migration, api] = await Promise.all([
    source("supabase/migrations/20260924183000_bis_content_compiler_runtime.sql"),
    source("app/api/content-studio/route.ts"),
  ]);
  assert.match(migration, /create table public\.content_source_files/);
  assert.match(migration, /create table public\.content_runtime_artifacts/);
  assert.match(migration, /create table public\.content_runtime_activations/);
  assert.match(migration, /uq_content_runtime_one_active/);
  assert.match(api, /contentRuntimeArtifacts/);
  assert.match(api, /contentRuntimeActivations/);
  assert.match(api, /status: "SUPERSEDED"/);
  assert.match(api, /status: "ROLLED_BACK"/);
});

test("raw sources remain administrator-only while compiled runtime artifacts are learner-readable", async () => {
  const migration = await source("supabase/migrations/20260924183000_bis_content_compiler_runtime.sql");
  assert.match(migration, /content_source_files_super_user/);
  assert.match(migration, /content_runtime_artifacts_super_user/);
  assert.match(migration, /content_runtime_activations_super_user/);
  assert.match(migration, /bis_content_runtime_read/);
  assert.match(migration, /name like 'runtime\/%'/);
});

test("dynamic learning runtime loads the learner edition before static fallback", async () => {
  const [player, runtime, learningApi] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/api/runtime-content/route.ts"),
    source("app/api/learning/route.ts"),
  ]);
  assert.ok(player.includes("kind=LEARNING_MODULE"));
  assert.ok(player.includes("edition="));
  assert.match(player, /if \(dynamic\.ok\)/);
  assert.match(runtime, /artifactKey/);
  assert.ok(runtime.includes("learning:"));
  assert.match(learningApi, /contentLibraryItems/);
  assert.match(learningApi, /learningCode/);
});

test("Universal V1 Labs stay in the canonical nine-investigation presentation", async () => {
  const [compiler, runner, frame, api] = await Promise.all([
    source("lib/content-compiler.ts"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("app/lab-investigation-frame.tsx"),
    source("app/api/universal-lab/route.ts"),
  ]);
  assert.match(compiler, /Universal BIS Labs require exactly 9 investigations/);
  assert.match(compiler, /add at least one learner prompt/);
  assert.match(runner, /<LabInvestigationFrame/);
  assert.match(runner, /Prefer not to answer/);
  assert.match(frame, /universal-investigation-nav/);
  assert.match(api, /saveInvestigation/);
  assert.match(api, /UNIVERSAL_LAB_INVESTIGATION_SAVED/);
});

test("runtime activation publishes all three learning releases together and supports rollback", async () => {
  const api = await source("app/api/content-studio/route.ts");
  assert.match(api, /for \(const edition of LEARNING_EDITION_KEYS\)/);
  assert.match(api, /status: "PUBLISHED"/);
  assert.match(api, /status: "CONTROLLED"/);
  assert.match(api, /rollbackActivation/);
  assert.match(api, /CONTENT_RUNTIME_ROLLED_BACK/);
});

test("package templates reflect the executable compiler contracts", async () => {
  const learning = JSON.parse(await source("content/templates/learning-module.package.example.json"));
  const lab = JSON.parse(await source("content/templates/lab.package.example.json"));
  assert.equal(learning.edition, "school");
  assert.equal(learning.treatment.pages.length, 13);
  assert.equal(lab.schemaVersion, "universal-lab-v1");
  assert.equal(lab.runtimeProfile, "UNIVERSAL_V1");
  assert.equal(lab.investigations.length, 9);
  assert.ok(lab.investigations.every((investigation) => investigation.prompts.length >= 1));
});
