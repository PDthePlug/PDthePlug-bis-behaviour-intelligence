import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("structural staff experiment progress carries Lab identity without private experiment wording", async () => {
  const migration = await source("supabase/migrations/20260917215000_rc01_scope_staff_progress_by_lab.sql");
  assert.match(migration, /e\.lab_code/);
  assert.match(migration, /security_barrier = true/);
  assert.doesNotMatch(migration, /target_pattern|target_condition|alternative_behaviour|expected_reward|notes/);
});

test("RC01 uses a typed structural staff progress mapping with Lab code", async () => {
  const mapping = await source("db/staff-progress.ts");
  assert.match(mapping, /sqliteTable\("staff_experiment_progress"/);
  assert.match(mapping, /labCode: text\("lab_code"\)/);
  assert.doesNotMatch(mapping, /targetPattern|targetCondition|alternativeBehaviour|expectedReward|notes/);
});

test("facilitator progress is scoped to the Habit cohort rather than the learner's latest unrelated Lab", async () => {
  const route = await source("app/api/staff/route.ts");
  assert.match(route, /async function progressRows\(userIds: string\[], labCode\?: string\)/);
  assert.match(route, /eq\(labEnrollments\.labCode, labCode\)/);
  assert.match(route, /eq\(staffExperimentProgress\.labCode, labCode\)/);
  assert.match(route, /progressRows\(\[\.\.\.new Set\(members\.map\(\(member\) => member\.learnerUserId\)\)\], "HAB"\)/);
  assert.doesNotMatch(route, /from\(experiments\)/);
});
