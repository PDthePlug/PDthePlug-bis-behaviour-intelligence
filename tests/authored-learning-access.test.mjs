import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";
import { loadPreparedLearningSource } from "../lib/prepared-learning-source.mjs";

const tools = await loadContentTools();
test.after(() => tools.dispose());
const source = await readFile("app/api/content-studio/authored-learning/route.ts", "utf8");
let identity = null, roles = [], versionStatus = "DRAFT", kind = "LEARNING_MODULE", sourceReads = 0;
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
const versions = { id: "id", status: "status" };
const items = { id: "id", kind: "kind", status: "status" };
const mocks = {
  and: (...values) => values, eq: (key, value) => ({ key, value }), contentLibraryItems: items, contentLibraryVersions: versions,
  identityFrom: async () => identity, getRoles: async () => roles,
  AccessError, requireRole: (values, role) => { if (!values.includes(role)) throw new AccessError("Denied", 403); },
  withSupabaseRequest: fn => fn(), isDeliveryEdition: value => ["school", "emerging_adult", "workplace"].includes(value),
  customerSafeErrorResponse: error => Response.json({ error: "The saved handbook could not be opened." }, { status: error.status ?? 400 }),
  copyPublishedPackageVersion: tools.copyPublishedPackageVersion,
  loadPreparedLearningSource: async (...args) => { sourceReads++; return loadPreparedLearningSource(...args); },
  getDb: () => ({ select: () => ({ from(table) { this.table = table; return this; }, where() { return this; }, async limit() {
    return this.table === versions
      ? versionStatus === "DRAFT" ? [{ id: "draft", itemId: "module:HAB", status: versionStatus, version: "2.0" }] : []
      : kind === "LEARNING_MODULE" ? [{ id: "module:HAB", code: "HAB", kind, status: "ACTIVE" }] : [];
  } }) }),
};
globalThis.__authoredLearningAccessMocks = mocks;
const moduleText = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, ""));
const declarations = `const {${Object.keys(mocks).join(",")}} = globalThis.__authoredLearningAccessMocks;\n`;
const { GET } = await import("data:text/javascript;base64," + Buffer.from(declarations + moduleText).toString("base64"));
const request = edition => GET(new Request(`https://bis.invalid/api/content-studio/authored-learning?versionId=draft&edition=${edition}`));

test("saved manuscripts stay inaccessible to signed-out users, learners and unrelated staff", async () => {
  sourceReads = 0;
  identity = null; roles = [];
  assert.equal((await request("school")).status, 401);
  identity = { id: "signed-in" };
  for (const role of ["LEARNER", "FACILITATOR", "ORG_ADMIN"]) {
    roles = [role]; assert.equal((await request("school")).status, 403);
  }
  assert.equal(sourceReads, 0);
});

test("only an administrator's editable learning version can receive the saved edition", async () => {
  identity = { id: "administrator" }; roles = ["SYSTEM_ADMIN"]; sourceReads = 0;
  for (const status of ["PUBLISHED", "APPROVED", "VALIDATED"]) {
    versionStatus = status; assert.equal((await request("school")).status, 400);
  }
  versionStatus = "DRAFT"; kind = "LAB";
  assert.equal((await request("school")).status, 400);
  kind = "LEARNING_MODULE";
  assert.equal((await request("../school")).status, 400);
  assert.equal(sourceReads, 0);
  const response = await request("workplace");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const payload = await response.json();
  assert.equal(payload.identity.code, "HAB"); assert.equal(payload.identity.version, "2.0"); assert.equal(payload.edition, "workplace");
  assert.ok(payload.sourceTrace.authority.includes("HAB-LM-1.0-WK"));
});
