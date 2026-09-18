import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("sponsor access is a first-class cohort-scoped staff role", async () => {
  const [access, route] = await Promise.all([
    source("lib/bis-access.ts"),
    source("app/api/staff/route.ts"),
  ]);

  assert.match(access, /"SPONSOR_VIEWER"/);
  assert.match(route, /role === "SPONSOR_VIEWER"/);
  assert.match(route, /scopeType = sponsorRole \? "COHORT" : "GLOBAL"/);
  assert.match(route, /Choose an active cohort for sponsor access/);
  assert.match(route, /SPONSOR_VIEWER/);
});

test("sponsor snapshot is aggregate-only and delegates calculation to the protected RPC", async () => {
  const route = await source("app/api/staff/route.ts");
  const start = route.indexOf("async function sponsorSnapshot");
  const end = route.indexOf("async function safeguardingSnapshot");
  assert.ok(start >= 0 && end > start);
  const sponsor = route.slice(start, end);

  assert.match(sponsor, /rpc\("sponsor_cohort_outcomes"/);
  assert.match(sponsor, /minimumReportableCohortSize: 5/);
  assert.doesNotMatch(sponsor, /learners\./);
  assert.doesNotMatch(sponsor, /responses/);
  assert.doesNotMatch(sponsor, /hypotheses/);
  assert.doesNotMatch(sponsor, /experimentEvents\.notes/);
});

test("database outcome boundary authorizes cohort scope and suppresses small cohorts", async () => {
  const migration = await source("supabase/migrations/20260918113000_programme_outcomes_sponsor_view.sql");

  assert.match(migration, /private\.can_view_sponsor_cohort/);
  assert.match(migration, /r\.role = 'SPONSOR_VIEWER'/);
  assert.match(migration, /r\.scope_type = 'COHORT'/);
  assert.match(migration, /r\.scope_id = target_cohort_id/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /if v_member_count < 5 then/);
  assert.match(migration, /'suppressed', true/);
  assert.match(migration, /revoke all on function public\.sponsor_cohort_outcomes\(text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.sponsor_cohort_outcomes\(text\) to authenticated/i);
});

test("programme outcomes answer behavioural questions rather than only completion", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  for (const question of [
    "Are people moving from preparation into action?",
    "What did participants predict—and what happened?",
    "Are the experiments actually being attempted?",
    "How much can we responsibly say?",
    "Did anything change in the next comparable situation?",
    "Did participants ask for help when they got stuck?",
  ]) {
    assert.match(view, new RegExp(question.replace(/[?]/g, "\\?")));
  }

  assert.match(view, /Completion/);
  assert.match(view, /Context only—not the outcome claim/);
  assert.match(view, /not enough evidence/i);
});

test("outcome calculation preserves prediction calibration, missingness and repeat-opportunity change", async () => {
  const migration = await source("supabase/migrations/20260918113000_programme_outcomes_sponsor_view.sql");

  assert.match(migration, /average_prediction_gap/);
  assert.match(migration, /evidence_none/);
  assert.match(migration, /evidence_limited/);
  assert.match(migration, /evidence_sufficient/);
  assert.match(migration, /first_response = false[\s\S]*last_response = true/);
  assert.match(migration, /source_type = 'LEARNER_REQUEST'/);
  assert.doesNotMatch(migration, /s\.summary/);
});

test("future behavioural questions are registered without being fabricated as current metrics", async () => {
  const route = await source("app/api/staff/route.ts");

  assert.match(route, /label: "Voice \/ silence", status: "FUTURE_SIGNAL"/);
  assert.match(route, /label: "Response to mistakes", status: "FUTURE_SIGNAL"/);
  assert.match(route, /label: "Ungraded feedback", status: "FUTURE_SIGNAL"/);
  assert.match(route, /label: "Prediction", status: "LIVE"/);
  assert.match(route, /label: "Support", status: "LIVE"/);
});
