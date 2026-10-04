import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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

test("the preflight actually refuses production and absent credentials", async () => {
  const compiled = ts.transpileModule(await source("tests/staging/global-setup.ts"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  const setup = (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)).default;
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "BIS_STAGING_LEARNER_EMAIL", "BIS_STAGING_LEARNER_PASSWORD", "BIS_STAGING_ADMIN_EMAIL", "BIS_STAGING_ADMIN_PASSWORD"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://swmhsqivqaqwovojbceo.supabase.co";
    assert.throws(setup, /BIS Production/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unknown.supabase.co";
    assert.throws(setup, /expected lbmhkddrkhtmkcvfmumd/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lbmhkddrkhtmkcvfmumd.supabase.co";
    assert.throws(setup, /PUBLISHABLE_KEY is required/);
    for (const name of names.slice(1)) process.env[name] = "test-only-placeholder";
    assert.doesNotThrow(setup);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("deployed backend identity is checked before filling any credential field", async () => {
  const support = await source("tests/staging/support.ts");
  assert.ok(support.indexOf('/api/staging-certification/environment') < support.indexOf('getByLabel("Email")'));
  assert.match(support, /identity\.projectRef/);
  assert.match(support, /stagingCertificationAllowed/);
});

test("persisted evidence mutation requires an explicit staging opt-in and controlled fixture", async () => {
  const suite = await source("tests/staging/runtime-and-evidence.spec.ts");
  assert.match(suite, /BIS_STAGING_ALLOW_MUTATIONS !== "true"/);
  assert.match(suite, /BIS_STAGING_EVIDENCE_FIXTURE/);
  assert.match(suite, /page\.reload\(\)/);
  assert.match(suite, /responses\[item\.semanticFieldId\]/);
});
