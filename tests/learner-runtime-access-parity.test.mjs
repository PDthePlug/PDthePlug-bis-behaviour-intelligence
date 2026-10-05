import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261005103000_learner_runtime_access_parity.sql", import.meta.url),
  "utf8",
);

test("authenticated learners can discover only active published runtime metadata", () => {
  assert.match(migration, /content_runtime_activations_active_read/);
  assert.match(migration, /content_edition_activations_active_read/);
  assert.match(migration, /content_library_versions_active_runtime_read/);
  assert.match(migration, /content_runtime_artifacts_active_read/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /status = 'PUBLISHED'/);
  assert.match(migration, /runtime_status = 'LIVE'/);
  assert.match(migration, /status = 'ACTIVE'/);
});

test("learner storage access is bound to active published artifact references", () => {
  assert.match(migration, /bis_active_content_artifact_read/);
  assert.match(migration, /r\.storage_path = objects\.name/);
  assert.match(migration, /content_runtime_activations/);
  assert.match(migration, /content_edition_activations/);
  assert.doesNotMatch(migration, /name\s+(?:like|~~)\s+'artifacts\/%'/i);
});

test("historical static enrolments no longer pin Universal-only Lab routes", () => {
  const functionBody = migration.slice(migration.indexOf("create or replace function public.learner_bis_lab_runtime"));
  assert.match(functionBody, /enrolled_dynamic/);
  assert.match(functionBody, /assigned_dynamic/);
  assert.match(functionBody, /runtime_mode = 'DYNAMIC'/);
  assert.match(functionBody, /select \* from live/);
  assert.doesNotMatch(functionBody, /'STATIC'::text/);
  assert.doesNotMatch(functionBody, /\/habit-lab|\/decision|\/money/);
});

test("the repair preserves historical evidence rather than rewriting learner rows", () => {
  assert.doesNotMatch(migration, /update\s+public\.lab_enrollments/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.(?:lab_enrollments|responses|evidence_records)/i);
});
