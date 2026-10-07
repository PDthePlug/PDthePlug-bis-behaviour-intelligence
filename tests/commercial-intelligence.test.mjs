import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Commercial Intelligence schema is isolated, auditable and write-gated", async () => {
  const migration = await source("supabase/migrations/20261006232429_bis_commercial_intelligence_v1.sql");
  const leastPrivilege = await source("supabase/migrations/20261006233844_bis_commercial_intelligence_v1_least_privilege.sql");
  const immutableAudit = await source("supabase/migrations/20261006234315_bis_commercial_intelligence_v1_immutable_audit.sql");

  for (const table of [
    "crm_agent_runs",
    "crm_recommendations",
    "crm_approvals",
    "crm_research_sources",
    "crm_generated_artifacts",
    "crm_signal_events",
  ]) {
    assert.ok(migration.includes("create table public." + table));
    assert.ok(leastPrivilege.includes("revoke all on table public." + table));
  }

  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.can_write_commercial/);
  assert.match(migration, /COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH/);

  const helper = migration.slice(
    migration.indexOf("private.can_write_commercial"),
    migration.indexOf("create table public.crm_agent_runs"),
  );
  assert.doesNotMatch(helper, /COMMERCIAL_READ_ONLY/);

  assert.match(leastPrivilege, /grant select, insert on table public\.crm_agent_runs to authenticated/);
  assert.match(leastPrivilege, /grant select, insert, update on table public\.crm_recommendations to authenticated/);
  assert.doesNotMatch(leastPrivilege, /grant .* to anon/);
  assert.match(migration, /never learner evidence/i);

  assert.match(immutableAudit, /Commercial recommendation evidence is immutable after creation/);
  assert.match(immutableAudit, /Commercial research source provenance is immutable after capture/);
});

test("Commercial Intelligence keeps irreversible work behind human approval", async () => {
  const [route, ai, engine] = await Promise.all([
    source("app/api/commercial/intelligence/route.ts"),
    source("lib/commercial-ai.ts"),
    source("lib/commercial-intelligence.ts"),
  ]);

  assert.match(route, /action === "decision"/);
  assert.match(route, /"APPROVED", "DISMISSED"/);
  assert.match(route, /crm_generated_artifacts/);
  assert.doesNotMatch(route, /sendEmail|sendWhatsapp|sendWhatsApp|markAsSent/);
  assert.match(route, /opportunity\.stage === "HOLD"/);
  assert.match(route, /RECIPIENT_COLLISION/);

  assert.match(ai, /store: false/);
  assert.match(ai, /VERCEL_OIDC_TOKEN/);
  assert.match(ai, /AI_GATEWAY_API_KEY/);
  assert.match(ai, /https:\/\/ai-gateway\.vercel\.sh\/v1\/responses/);
  assert.match(ai, /openai\/gpt-5\.6-luna/);
  assert.match(ai, /External contact, sends, pricing changes, WON\/LOST decisions and terms always require human approval/);
  assert.match(ai, /Do not request or expose learner evidence/);
  assert.doesNotMatch(ai, /NEXT_PUBLIC_(?:OPENAI|AI_GATEWAY)/);

  assert.match(engine, /isSequenceHold/);
  assert.match(engine, /OUTREACH_APPROVAL/);
  assert.match(engine, /BUYER_VERIFICATION/);
  assert.match(engine, /FOLLOW_UP/);
});

test("Commercial workspace keeps Overview as home and exposes Intelligence additively", async () => {
  const [workspace, api, env] = await Promise.all([
    source("app/commercial/commercial-workspace.tsx"),
    source("app/api/commercial/route.ts"),
    source(".env.example"),
  ]);

  assert.match(workspace, /"intelligence".*"overview".*"pipeline"/s);
  assert.match(workspace, /: "overview";/);
  assert.ok(workspace.includes("Commercial Intelligence"));
  assert.match(workspace, /section=intelligence/);
  assert.match(workspace, /DRAFT_READY/);
  assert.match(api, /"DRAFT_READY"/);
  assert.match(env, /AI_GATEWAY_API_KEY=/);
  assert.match(env, /AI_GATEWAY_MODEL=openai\/gpt-5\.6-luna/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_(?:OPENAI|AI_GATEWAY)/);
});

test("Commercial Intelligence UI explains its automation boundary in customer language", async () => {
  const [panel, route] = await Promise.all([
    source("app/commercial/commercial-intelligence-panel.tsx"),
    source("app/api/commercial/intelligence/route.ts"),
  ]);

  for (const phrase of [
    "Founder operating brief",
    "What deserves your attention",
    "Ask the pipeline, not your memory.",
    "Prepare aggressively. Execute carefully.",
    "Draft only · nothing has been sent",
  ]) {
    assert.ok(panel.includes(phrase), "Missing UI phrase: " + phrase);
  }

  assert.match(panel, /needsRefresh && next\.canWrite/);
  assert.match(panel, /action: "refresh", mode/);
  assert.match(panel, /action: "draft"/);
  assert.match(panel, /action: "decision"/);
  assert.match(route, /timeZone: "Africa\/Johannesburg"/);
});
