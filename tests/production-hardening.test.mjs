import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("application-wide browser security headers protect every route", async () => {
  const source = await read("next.config.ts");
  assert.match(source, /source: "\/:path\*"/);
  for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.match(source, new RegExp(header));
  }
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /VERCEL_ENV === "production"/);
});

test("priority API routes use the shared customer-safe error boundary", async () => {
  const routes = [
    "app/api/learning/route.ts",
    "app/api/universal-lab/route.ts",
    "app/api/staff/route.ts",
    "app/api/content-studio/route.ts",
    "app/api/content-studio/preview/route.ts",
    "app/api/content-studio/volume-audit/route.ts",
  ];
  for (const route of routes) {
    const source = await read(route);
    assert.match(source, /customerSafeErrorResponse/, `${route} must sanitize caught errors`);
    assert.doesNotMatch(source, /Response\.json\(\s*\{\s*error:\s*error instanceof Error \? error\.message/, `${route} leaks exception text`);
  }
  const boundary = await read("lib/api-error-response.ts");
  assert.match(boundary, /console\.error/);
  assert.match(boundary, /error: fallback/);
});

test("active Lab runtimes attach images to stable evidence context", async () => {
  const component = await read("components/evidence/evidence-images.tsx");
  assert.match(component, /\$\{enrollmentId\}\/\$\{safeLab\}\/I\$\{investigation\}\/\$\{safeField\}/);
  for (const runtime of ["app/bis-app.tsx", "app/core-lab-experience.tsx", "app/labs/[code]/universal-runtime-lab.tsx"]) {
    const source = await read(runtime);
    assert.match(source, /<EvidenceImages/);
    assert.match(source, /evidenceFieldId=/);
  }
  const migration = await read("supabase/migrations/20261003230000_all_lab_private_evidence_context.sql");
  assert.doesNotMatch(migration, /e\.lab_code = 'HAB'/);
  assert.match(migration, /e\.lab_code = \(storage\.foldername\(name\)\)\[3\]/);
  assert.match(migration, /consent_type = 'LEARNER_PRODUCT'/);
  assert.match(migration, /auth\.uid/);
});


test("evidence Storage migration preserves legacy owner access while keeping uploads immutable", async () => {
  const migration = await read("supabase/migrations/20261003230000_all_lab_private_evidence_context.sql");
  assert.match(migration, /array_length\(storage\.foldername\(name\), 1\) = 2/);
  assert.match(migration, /array_length\(storage\.foldername\(name\), 1\) = 5/);
  assert.match(migration, /create policy bis_evidence_delete/);
  assert.doesNotMatch(migration, /create policy bis_evidence_update/i);
  assert.match(migration, /storage\.filename\(name\) ~ '\^\[1-5\]/);
});
