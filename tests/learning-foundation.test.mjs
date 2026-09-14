import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("establishes canonical delivery editions separately from programme context", async () => {
  const [foundation, schema, migration] = await Promise.all([
    read("lib/learning-foundation.ts"),
    read("db/schema.ts"),
    read("supabase/migrations/20260914090000_bis_learning_foundation.sql"),
  ]);
  assert.match(foundation, /"school", "emerging_adult", "workplace"/);
  assert.match(foundation, /"youth_programme"/);
  assert.match(schema, /deliveryEdition: text\("delivery_edition"\)/);
  assert.match(schema, /deliveryContext: text\("delivery_context"\)/);
  assert.match(migration, /learners_delivery_edition_check/);
  assert.match(migration, /learners_delivery_context_check/);
});

test("registers immutable, versioned curriculum releases", async () => {
  const [foundation, schema, migration] = await Promise.all([
    read("lib/learning-foundation.ts"),
    read("db/schema.ts"),
    read("supabase/migrations/20260914090000_bis_learning_foundation.sql"),
  ]);
  for (const edition of ["school", "emerging_adult", "workplace"]) {
    assert.match(foundation, new RegExp(`deliveryEdition: "${edition}"`));
  }
  assert.match(schema, /export const contentReleases/);
  assert.match(migration, /release_hash text not null/);
  assert.match(migration, /uq_content_release_identity/);
  assert.match(migration, /content_release_id text references public\.content_releases/);
});

test("isolates active experiments and evidence by Lab", async () => {
  const [schema, labsRoute, habitRoute, migration] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/labs/route.ts"),
    read("app/api/bis/route.ts"),
    read("supabase/migrations/20260914090000_bis_learning_foundation.sql"),
  ]);
  assert.match(schema, /experimentProtocol: text\("experiment_protocol"\)/);
  assert.match(migration, /uq_active_experiment_user_lab/);
  assert.match(labsRoute, /eq\(experiments\.labCode, lab\.code\)/);
  assert.match(labsRoute, /labCode: lab\.code/);
  assert.match(labsRoute, /contentReleaseId: enrolment\.contentReleaseId/);
  assert.match(habitRoute, /eq\(experiments\.labCode, "HAB"\)/);
  assert.match(habitRoute, /experimentProtocol: "HABIT_REPLACEMENT"/);
  assert.match(habitRoute, /eq\(responses\.labCode, "HAB"\)/);
});

test("provides server-backed semantic handbook progress with learner-owned RLS", async () => {
  const [schema, route, migration] = await Promise.all([
    read("db/schema.ts"),
    read("app/api/learning/route.ts"),
    read("supabase/migrations/20260914090000_bis_learning_foundation.sql"),
  ]);
  assert.match(schema, /export const handbookProgress/);
  assert.match(route, /semanticStepId/);
  assert.match(route, /startsWith\(`\$\{labCode\}\.`\)/);
  assert.match(route, /setDeliveryEdition/);
  assert.match(migration, /alter table public\.handbook_progress enable row level security/);
  assert.match(migration, /user_id = private\.current_app_user_id\(\)/);
});

test("reserves evidence-derived certificate provenance", async () => {
  const [schema, migration, indexes] = await Promise.all([
    read("db/schema.ts"),
    read("supabase/migrations/20260914090000_bis_learning_foundation.sql"),
    read("supabase/migrations/20260914091000_bis_learning_foundation_indexes.sql"),
  ]);
  assert.match(schema, /export const certificateAwards/);
  assert.match(migration, /evidence_snapshot text not null/);
  assert.match(migration, /enrolment_id text not null references public\.lab_enrollments/);
  assert.match(indexes, /idx_handbook_progress_content_release/);
  assert.match(indexes, /idx_certificate_content_release/);
});
