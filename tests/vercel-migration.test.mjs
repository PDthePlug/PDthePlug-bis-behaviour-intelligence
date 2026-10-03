import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("uses the standard Next.js Vercel runtime without retired hosting adapters", async () => {
  const [packageJson, proxy, database] = await Promise.all([
    read("package.json"),
    read("proxy.ts"),
    read("db/index.ts"),
  ]);
  const manifest = JSON.parse(packageJson);
  assert.equal(manifest.scripts.dev, "npm run runtime:check && next dev");
  assert.equal(manifest.scripts.build, "next build");
  assert.equal(manifest.scripts.start, "npm run runtime:check && next start");
  assert.equal(manifest.scripts["vercel-build"], "npm run verify:build");
  assert.equal(manifest.scripts.verify, "npm run verify:build && npm run test:browser");
  assert.doesNotMatch(packageJson, /vinext|wrangler|cloudflare/i);
  assert.match(proxy, /updateSession/);
  assert.doesNotMatch(database, /cloudflare:workers|D1Database/);
});

test("uses verified Supabase users and a request-scoped database client", async () => {
  const [access, server, learnerRoute, labsRoute, staffRoute] = await Promise.all([
    read("lib/bis-access.ts"),
    read("lib/supabase/server.ts"),
    read("app/api/bis/route.ts"),
    read("app/api/labs/route.ts"),
    read("app/api/staff/route.ts"),
  ]);
  assert.match(access, /auth\.getUser\(\)/);
  assert.doesNotMatch(access, /oai-authenticated-user/);
  assert.match(server, /AsyncLocalStorage/);
  for (const route of [learnerRoute, labsRoute, staffRoute]) {
    assert.match(route, /withSupabaseRequest/);
    assert.match(route, /await identityFrom\(\)/);
  }
});

test("keeps only public Supabase configuration in deployment examples", async () => {
  const [example, client, config] = await Promise.all([
    read(".env.example"),
    read("lib/supabase/client.ts"),
    read("lib/supabase/config.ts"),
  ]);
  assert.match(example, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(client, /supabaseBrowserConfig/);
  assert.match(config, /swmhsqivqaqwovojbceo\.supabase\.co/);
  assert.doesNotMatch(config, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(example, /SERVICE_ROLE|DATABASE_URL|DB_PASSWORD|SECRET/i);
  assert.doesNotMatch(`${client}\n${config}`, /service.role|service_role|database_url|sb_secret_/i);
});

test("protects every production table and exposes only structural staff progress", async () => {
  const migration = await read("supabase/migrations/20260909000000_bis_production.sql");
  const explicitRls = [
    "learners",
    "lab_enrollments",
    "role_assignments",
    "pilot_cohorts",
    "cohort_members",
    "lab_assignments",
    "facilitator_notes",
    "safeguarding_cases",
    "audit_events",
    "pilot_events",
  ];
  for (const table of explicitRls) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  for (const table of [
    "consent_records",
    "responses",
    "evidence_records",
    "hypotheses",
    "experiments",
    "experiment_events",
    "experiment_parameter_versions",
    "experiment_checkpoints",
    "measurement_values",
    "measurement_sources",
    "notification_preferences",
    "memory_items",
    "companion_turns",
  ]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  const progressView = migration.match(/create view public\.staff_experiment_progress[\s\S]*?create view public\.staff_experiment_event_progress/i)?.[0] ?? "";
  assert.doesNotMatch(progressView, /target_pattern|target_condition|alternative_behaviour|expected_reward|notes/);
  assert.match(migration, /revoke all on all tables in schema public from public, anon/i);
});

test("preserves legacy application identities while linking Supabase Auth", async () => {
  const [schema, migration] = await Promise.all([
    read("db/schema.ts"),
    read("supabase/migrations/20260909000000_bis_production.sql"),
  ]);
  assert.match(schema, /authUserId: text\("auth_user_id"\)/);
  assert.match(migration, /user_id text primary key/);
  assert.match(migration, /auth_user_id uuid unique references auth\.users/);
  assert.match(migration, /bind_legacy_learner/);
});
