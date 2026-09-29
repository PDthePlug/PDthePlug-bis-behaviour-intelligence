import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("learning editions are independent publishing slots inside one BIS title", async () => {
  const [compiler, api, ui, migration] = await Promise.all([
    source("lib/content-compiler.ts"),
    source("app/api/content-studio/route.ts"),
    source("app/content-studio/content-studio.tsx"),
    source("supabase/migrations/20260925093000_content_studio_founder_flow.sql"),
  ]);
  assert.match(compiler, /LEARNING_EDITION_KEYS = \[\.\.\.DELIVERY_EDITIONS\]/);
  for (const edition of ["school", "emerging_adult", "workplace"]) {
    assert.ok(ui.includes(edition));
  }
  assert.match(api, /editionsToCompile/);
  assert.match(api, /contentEditionActivations/);
  assert.match(migration, /content_edition_activations/);
  assert.match(ui, /Each edition can move at its own pace/);
  assert.match(ui, /Coming soon/);
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
  const [baseMigration, founderMigration, api] = await Promise.all([
    source("supabase/migrations/20260924183000_bis_content_compiler_runtime.sql"),
    source("supabase/migrations/20260925093000_content_studio_founder_flow.sql"),
    source("app/api/content-studio/route.ts"),
  ]);
  assert.match(baseMigration, /create table public\.content_source_files/);
  assert.match(baseMigration, /create table public\.content_runtime_artifacts/);
  assert.match(baseMigration, /create table public\.content_runtime_activations/);
  assert.match(founderMigration, /create table public\.content_edition_activations/);
  assert.match(api, /contentRuntimeArtifacts/);
  assert.match(api, /contentEditionActivations/);
});

test("raw sources remain administrator-only while compiled runtime artifacts are learner-readable", async () => {
  const migration = await source("supabase/migrations/20260924183000_bis_content_compiler_runtime.sql");
  assert.match(migration, /content_source_files_super_user/);
  assert.match(migration, /content_runtime_artifacts_super_user/);
  assert.match(migration, /bis_content_runtime_read/);
  assert.match(migration, /name like 'runtime\/%'/);
});

test("dynamic learning runtime resolves the learner edition independently before static fallback", async () => {
  const [player, runtime, catalogue] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/api/runtime-content/route.ts"),
    source("app/api/runtime-catalogue/route.ts"),
  ]);
  assert.ok(player.includes("kind=LEARNING_MODULE"));
  assert.ok(player.includes("edition="));
  assert.match(runtime, /contentEditionActivations/);
  assert.match(runtime, /deliveryEdition/);
  assert.match(runtime, /This learning edition is not published yet/);
  assert.match(catalogue, /deliveryEdition/);
});

test("static learning handbooks are decoded server-side for browser compatibility", async () => {
  const runtime = await source("app/api/runtime-content/route.ts");
  assert.match(runtime, /gunzipSync/);
  assert.match(runtime, /STATIC_LEARNING_SLUGS/);
  assert.match(runtime, /runtimeMode === "STATIC"/);
  assert.match(runtime, /handbooks\/v1/);
  assert.match(runtime, /published programme could not be opened/);
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
});

test("Word PDF HTML Markdown and ZIP learning sources can be manufactured into Programme Player content", async () => {
  const [adapters, compiler, player] = await Promise.all([
    source("lib/content-source-adapters.ts"),
    source("lib/content-compiler.ts"),
    source("app/learning/programme-player.tsx"),
  ]);
  for (const format of ["DOCX", "PDF", "HTML", "MARKDOWN", "ZIP"]) {
    assert.ok(adapters.includes('sourceFormat === "' + format + '"'));
  }
  assert.match(adapters, /balancedProgrammePages/);
  assert.match(adapters, /strictProgrammePageKey/);
  assert.match(adapters, /INVESTIGATION\\s\+\)\?CERTIFICATE|INVESTIGATION/);
  assert.match(adapters, /DAY\\s\+\(10\|\[1-9\]\).*OF\\s\+10/);
  assert.match(adapters, /programmeExperimentPosition/);
  assert.match(adapters, /handbookQuestionPrompts/);
  assert.match(adapters, /handbookChoice/);
  assert.match(adapters, /pseudoTableBlock/);
  assert.match(adapters, /answerColumn/);
  assert.match(adapters, /word\/document\.xml/);
  assert.match(adapters, /PDF source contains no extractable text/);
  assert.match(adapters, /HTML source contains executable content/);
  assert.match(adapters, /inflateRawSync/);
  assert.match(compiler, /ensureWorkbookBindings/);
  assert.match(compiler, /stableWorkbookToken/);
  assert.match(player, /HTMLInputElement \| HTMLSelectElement/);
});

test("structured Lab documents can be manufactured into nine-investigation runtime data", async () => {
  const [adapters, compiler, runner, studioCss] = await Promise.all([
    source("lib/content-source-adapters.ts"),
    source("lib/content-compiler.ts"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("app/content-studio/content-studio.css"),
  ]);
  assert.match(adapters, /labPackageFromBlocks/);
  assert.match(adapters, /all nine investigation sections/);
  assert.match(adapters, /sourceFormat === "DOCX"/);
  assert.match(adapters, /sourceFormat === "PDF"/);
  assert.match(adapters, /sourceFormat === "MARKDOWN"/);
  assert.match(adapters, /tableRows/);
  assert.match(adapters, /facilitatorIndex/);
  assert.match(adapters, /certificateIndex/);
  assert.match(adapters, /investigation\\s\*\[1-9\]\\s\*of\\s\*9/);
  assert.match(adapters, /lastIndexOf\("\?"\)/);
  assert.match(adapters, /Risk baseline/);
  assert.match(adapters, /Probability \(1–5\)/);
  assert.match(adapters, /Day " \+ day/);
  assert.match(compiler, /MULTI_SELECT/);
  assert.match(compiler, /UniversalLabRenderBlock/);
  assert.match(runner, /universal-multi-select/);
  assert.match(runner, /investigation\.blocks/);
  assert.match(studioCss, /content-source-slot>\.content-paste-box/);
  assert.match(studioCss, /width:100%/);
});

test("package templates still reflect executable runtime contracts", async () => {
  const learning = JSON.parse(await source("content/templates/learning-module.package.example.json"));
  const lab = JSON.parse(await source("content/templates/lab.package.example.json"));
  assert.equal(learning.edition, "school");
  assert.equal(learning.treatment.pages.length, 13);
  assert.equal(lab.schemaVersion, "universal-lab-v1");
  assert.equal(lab.runtimeProfile, "UNIVERSAL_V1");
  assert.equal(lab.investigations.length, 9);
});
