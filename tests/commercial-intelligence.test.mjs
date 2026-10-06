import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Commercial Intelligence schema is isolated, auditable and write-gated", async () => {
  const migration = await source("supabase/migrations/20261006232429_bis_commercial_intelligence_v1.sql");
  for (const table of [
    "crm_agent_runs",
    "crm_recommendations",
    "crm_approvals",
    "crm_research_sources",
    "crm_generated_artifacts",
    "crm_signal_events",
  ]) {
    assert.ok(migration.includes("create table public." + table));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.can_write_commercial/);
  assert.match(migration, /COMMERCIAL_ADMIN','COMMERCIAL_LEAD','COMMERCIAL_RESEARCH/);
  const helper = migration.slice(
    migration.indexOf("private.can_write_commercial"),
    migration.indexOf("create table public.crm_agent_runs"),
  );
  assert.doesNotMatch(helper, /COMMERCIAL_READ_ONLY/);
  assert.match(migration, /revoke delete on public\.crm_agent_runs from authenticated/);
  assert.match(migration, /never learner evidence/i);
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
  assert.match(ai, /VERCEL_OIDC_TOKEN/);\n  assert.match(ai, /AI_GATEWAY_API_KEY/);\n  assert.match(ai, /https:\/\/ai-gateway\\.vercel\\.sh\/v1\/responses/);
  assert.match(ai, /External contact, sends, pricing changes, WON\/LOST decisions and terms always require human approval/);
  assert.match(ai, /Do not request or expose learner evidence/);
  assert.doesNotMatch(ai, /NEXT_PUBLIC_(?:OPENAI|AI_GATEWAY)/);

  assert.match(engine, /isSequenceHold/);
  assert.match(engine, /OUTREACH_APPROVAL/);
  assert.match(engine, /BUYER_VERIFICATION/);
  assert.match(engine, /FOLLOW_UP/);
});

test("Commercial workspace opens on Intelligence and recognizes the live draft-ready stage", async () => {
  const [workspace, api, env] = await Promise.all([
    source("app/commercial/commercial-workspace.tsx"),
    source("app/api/commercial/route.ts"),
    source(".env.example"),
  ]);
  assert.match(workspace, /"intelligence".*"overview".*"pipeline"/s);
  assert.match(workspace, /: "intelligence";/);
  assert.match(workspace, /DRAFT_READY/);
  assert.match(api, /"DRAFT_READY"/);
  assert.match(env, /OPENAI_API_KEY=/);
  assert.match(env, /OPENAI_COMMERCIAL_MODEL=gpt-5\.6-luna/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_OPENAI_API_KEY/);
});

test("Commercial Intelligence UI explains its automation boundary in customer language", async () => {
  const panel = await source("app/commercial/commercial-intelligence-panel.tsx");
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
  const route = await source("app/api/commercial/intelligence/route.ts");
  assert.match(route, /timeZone: "Africa\\/Johannesburg"/);
});
