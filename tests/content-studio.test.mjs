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
  for (const action of ["createItem", "createVersion", "attachSource", "compileVersion", "approveVersion", "activateVersion", "rollbackActivation", "reopenVersion"]) {
    assert.ok(api.includes('action === "' + action + '"'));
  }
  assert.match(ui, /action: "createItem"/);
  assert.match(ui, /action: "createVersion"/);
  assert.match(ui, /action: "attachSource"/);
  assert.match(ui, /action: "compileVersion"/);
  assert.match(ui, /action: "approveVersion"/);
  assert.match(ui, /action: "activateVersion"/);
  assert.match(ui, /action: "rollbackActivation"/);
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

test("Content Studio accepts source documents but only BIS JSON packages can be activation-ready", async () => {
  const contract = await source("lib/content-studio.ts");
  for (const format of ["BIS_PACKAGE_JSON", "DOCX", "PDF", "HTML", "MARKDOWN", "ZIP"]) {
    assert.ok(contract.includes('"' + format + '"'));
  }
  assert.match(contract, /needs to be converted into a BIS package before it can be activated/);
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
