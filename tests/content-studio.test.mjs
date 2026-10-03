import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Content Studio is restricted to the SYSTEM_ADMIN super user role", async () => {
  const [api, migration, page] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("supabase/migrations/20260924153000_bis_content_studio.sql"),
    source("app/content-studio/page.tsx"),
  ]);
  assert.match(api, /requireRole\(roles, "SYSTEM_ADMIN"\)/);
  assert.match(migration, /private\.has_staff_role\('SYSTEM_ADMIN'\)/);
  assert.match(page, /requireUser\("\/content-studio"\)/);
});

test("Content Studio separates catalogue identity, versions and private source packages", async () => {
  const migration = await source("supabase/migrations/20260924153000_bis_content_studio.sql");
  assert.match(migration, /create table public\.content_library_items/);
  assert.match(migration, /create table public\.content_library_versions/);
  assert.match(migration, /bis-content-studio/);
  assert.match(migration, /content_library_items_super_user/);
  assert.match(migration, /content_library_versions_super_user/);
});

test("current BIS modules and Labs are registered as live system content", async () => {
  const migration = await source("supabase/migrations/20260924153000_bis_content_studio.sql");
  for (const id of [
    "content:lab:HAB",
    "content:lab:DEC",
    "content:lab:MON",
    "content:module:HAB",
    "content:module:DEC",
    "content:module:MON",
    "content:module:IDN",
    "content:module:ATT",
  ]) {
    assert.ok(migration.includes(id));
  }
  assert.match(migration, /'PUBLISHED','SYSTEM'/);
  assert.match(migration, /'LIVE'/);
});

test("new content follows create, edition upload, compile, approve and explicit activation gates", async () => {
  const [api, ui] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("app/content-studio/content-studio.tsx"),
  ]);
  for (const action of ["createItem", "createVersion", "attachSource", "compileVersion", "approveVersion", "activateVersion", "reopenVersion"]) {
    assert.ok(api.includes('action === "' + action + '"'));
  }
  assert.match(ui, /action: "createItem"/);
  assert.match(ui, /action: "createVersion"/);
  assert.match(ui, /action: "attachSource"/);
  assert.match(ui, /action: "compileVersion"/);
  assert.match(ui, /action: "approveVersion"/);
  assert.match(ui, /action: "activateVersion"/);
  assert.doesNotMatch(api, /action === "publishVersion"/);
});

test("private uploaded sources are confirmed and fingerprinted before validation", async () => {
  const api = await source("app/api/content-studio/route.ts");
  assert.match(api, /sourceStoragePath\.startsWith/);
  assert.match(api, /CONTENT_STUDIO_BUCKET/);
  assert.match(api, /sha256Hex\(bytes\)/);
  assert.match(api, /sourceHash/);
  assert.match(api, /sourceBytes: bytes\.byteLength/);
});

test("Content Studio accepts editorial source formats and defers execution to the compiler", async () => {
  const contract = await source("lib/content-studio.ts");
  for (const format of ["BIS_PACKAGE_JSON", "DOCX", "PDF", "HTML", "MARKDOWN", "ZIP"]) {
    assert.ok(contract.includes('"' + format + '"'));
  }
  assert.match(contract, /Content Compiler will run the approved source adapter/);
  assert.match(contract, /runtimeStatus: valid \? "REQUIRES_ADAPTER" : "BLOCKED"/);
  assert.match(contract, /unsafeHtml/);
});

test("future content has stable module and Lab package contracts", async () => {
  const contract = await source("lib/content-studio.ts");
  assert.match(contract, /validateLearningPackage/);
  assert.match(contract, /validateLabPackage/);
  assert.match(contract, /Learning sequence present/);
  assert.match(contract, /Investigation sequence/);
  assert.match(contract, /Runtime profile/);
});

test("Administration exposes the Content Studio only to administrators", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /adminAvailable \? <Link className="staff-workspace-learner-link" href="\/content-studio">Content Studio<\/Link> : null/);
});


test("the complete 34-title BIS catalogue is available for filling from Content Studio", async () => {
  const migration = await source("supabase/migrations/20260925093000_content_studio_founder_flow.sql");
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  assert.equal(catalogue.modules.length, 34);
  for (const entry of catalogue.modules) {
    assert.ok(migration.includes("content:module:" + entry.code));
    assert.ok(migration.includes("content:lab:" + entry.code));
  }
});

test("Content Studio presents founder-facing language and supports pasted text", async () => {
  const [ui, contract] = await Promise.all([
    source("app/content-studio/content-studio.tsx"),
    source("lib/content-studio.ts"),
  ]);
  assert.match(ui, /Choose a BIS title and add the content that is ready/);
  assert.match(ui, /Prepare preview/);
  assert.match(ui, /Approve for publishing/);
  assert.match(ui, /Paste text/);
  assert.match(contract, /text\/plain/);
});


test("learner runtime can resolve active catalogue rows without opening Content Studio writes", async () => {
  const migration = await source("supabase/migrations/20260930233000_learner_active_content_catalogue_read.sql");
  assert.match(migration, /create policy content_library_items_active_read/);
  assert.match(migration, /for select/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /using \(status = 'ACTIVE'\)/);
  assert.doesNotMatch(migration, /for (?:insert|update|delete|all)/i);
  assert.match(migration, /Archived catalogue rows and mutations remain administrator-only/);
});


test("Content Studio exposes the prepared Lab runtime proof before publishing", async () => {
  const [api, ui] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("app/content-studio/content-studio.tsx"),
  ]);
  assert.match(api, /runtimeProfile: preparedLab\.runtimeProfile/);
  assert.match(api, /detectedCapabilities/);
  assert.match(api, /calculatedFields/);
  assert.match(api, /indicatorCount/);
  assert.match(api, /unboundIndicators/);
  assert.match(api, /experimentDays/);
  assert.match(api, /profileEntries/);
  assert.match(ui, /real-world test ready/);
  assert.match(ui, /programme measures connected/);
  assert.match(ui, /values calculated automatically/);
  assert.match(ui, /profile fields connected/);
  assert.match(ui, /Advanced details/);
});


test("stale compiler artifacts cannot be previewed approved or published", async () => {
  const [api, preview, ui] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("app/api/content-studio/preview/route.ts"),
    source("app/content-studio/content-studio.tsx"),
  ]);

  assert.match(api, /compilerIsCurrent/);
  assert.match(api, /requireCurrentCompilation/);
  assert.match(api, /compilerCurrent: compilerIsCurrent\(row\)/);
  assert.match(api, /staleReviewable/);
  assert.match(preview, /version\.compilerVersion !== CONTENT_COMPILER_VERSION/);
  assert.match(preview, /Prepare the version again before reviewing it/);
  assert.match(ui, /Re-prepare required/);
  assert.match(ui, /Re-prepare preview/);
  assert.match(ui, /Your uploaded source stays in place/);
});


test("Content Studio surfaces the Habit standard and blocks editorially unfinished Labs from approval", async () => {
  const [api, ui, compiler] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("app/content-studio/content-studio.tsx"),
    source("lib/content-compiler.ts"),
  ]);
  assert.match(api, /editorialStatus/);
  assert.match(api, /Strengthen the Lab source before approval/);
  assert.match(api, /editorialAudit\?\.status === "BLOCKED"/);
  assert.match(ui, /Habit Lab standard 1\.0/);
  assert.match(ui, /Editorial review before approval/);
  assert.match(compiler, /applyHabitLabStandard/);
  assert.match(compiler, /bis-content-compiler-4/);
});


test("Content Studio audits question quality using the minimum-question evidence rule", async () => {
  const [api, ui, audit] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("app/content-studio/content-studio.tsx"),
    source("lib/question-quality.mjs"),
  ]);

  assert.match(api, /auditLabQuestionQuality/);
  assert.match(api, /questionQuality/);
  assert.match(ui, /Question quality/);
  assert.match(ui, /learner questions/);
  assert.match(ui, /values not re-asked/);
  assert.match(ui, /answers reused downstream/);
  assert.match(audit, /Ask once when possible\. Reuse the answer\. Derive what can safely be derived\./);
});


test("question intelligence remains a candidate until the exact Lab version passes governed publishing", async () => {
  const [api, schema, migration] = await Promise.all([
    source("app/api/content-studio/route.ts"),
    source("db/schema.ts"),
    source("supabase/migrations/20261003130000_question_intelligence_registry.sql"),
  ]);

  assert.match(schema, /questionAnalysisRegistry[\s\S]*status: text\("status"\)\.notNull\(\)\.default\("CANDIDATE"\)/);
  assert.match(migration, /status text not null default 'CANDIDATE'/);
  assert.match(api, /if \(item\.kind === "LAB"\) \{[\s\S]*db\.update\(questionAnalysisRegistry\)[\s\S]*status: "ACTIVE"[\s\S]*versionId/);
  assert.match(api, /Finish the preview checklist and sign off this exact version before publishing/);
});
