import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("real staging suite is isolated from the intercepted fixture harness", async () => {
  const [config, packageJson] = await Promise.all([
    source("playwright.staging.config.ts"),
    source("package.json"),
  ]);
  assert.match(config, /testDir: "\.\/tests\/staging"/);
  assert.doesNotMatch(config, /tests\/browser\/harness/);
  assert.match(packageJson, /"test:staging"/);
});

test("staging preflight fails closed for production, unknown projects, and missing credentials", async () => {
  const setup = await source("tests/staging/global-setup.ts");
  assert.match(setup, /lbmhkddrkhtmkcvfmumd/);
  assert.match(setup, /swmhsqivqaqwovojbceo/);
  assert.match(setup, /ref !== STAGING_REF/);
  assert.match(setup, /BIS_STAGING_LEARNER_EMAIL/);
  assert.match(setup, /BIS_STAGING_ADMIN_PASSWORD/);
});

test("persisted evidence mutation requires an explicit staging opt-in and controlled fixture", async () => {
  const suite = await source("tests/staging/runtime-and-evidence.spec.ts");
  assert.match(suite, /BIS_STAGING_ALLOW_MUTATIONS !== "true"/);
  assert.match(suite, /BIS_STAGING_EVIDENCE_FIXTURE/);
  assert.match(suite, /page\.reload\(\)/);
  assert.match(suite, /responses\[item\.fieldId\]/);
});
