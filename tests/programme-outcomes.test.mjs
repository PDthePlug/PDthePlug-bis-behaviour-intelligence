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


test("deeper analysis generalises experiment context without exposing experiment wording", async () => {
  const [route, migration, view] = await Promise.all([
    source("app/api/staff/route.ts"),
    source("supabase/migrations/20260918123500_programme_outcomes_deeper_analysis.sql"),
    source("app/programme-outcomes-view.tsx"),
  ]);

  assert.match(route, /rpc\("sponsor_cohort_deeper_analysis"/);
  assert.match(migration, /themeSource', 'Learner-selected structured impact domains only'/);
  assert.match(migration, /minimumReportableThemeSize', 3/);
  assert.match(migration, /participants >= 3/);
  for (const domain of ["Health", "Money", "Relationships", "School", "Work", "Mental wellbeing"]) {
    assert.match(migration, new RegExp("'" + domain + "'"));
  }
  assert.doesNotMatch(migration, /target_pattern/i);
  assert.doesNotMatch(migration, /target_condition/i);
  assert.doesNotMatch(migration, /alternative_behaviour/i);
  assert.doesNotMatch(migration, /expected_reward/i);
  assert.doesNotMatch(migration, /experiment_events\.notes/i);
  assert.match(view, /Generalised from structured impact-domain tags—not private experiment wording/);
});

test("deeper analysis is an explicit expandable sponsor layer", async () => {
  const [view, css] = await Promise.all([
    source("app/programme-outcomes-view.tsx"),
    source("app/programme-outcomes-view.css"),
  ]);

  assert.match(view, /<details className="outcomes-deeper-analysis">/);
  assert.match(view, /What were people actually exploring—and what should we investigate next\?/);
  assert.match(view, /Experiment landscape/);
  assert.match(view, /System opportunities/);
  assert.match(view, /Question for the sponsor/);
  assert.match(css, /\.outcomes-deeper-analysis/);
  assert.match(css, /\.opportunity-list/);
});

test("system opportunity signals remain evidence-based review questions rather than causal claims", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  for (const signal of [
    "Activation friction",
    "Too little real-world exposure",
    "Prediction and practice are far apart",
    "Limited repeat exposure",
    "Human support demand is material",
    "Experiment context is under-specified",
  ]) {
    assert.match(view, new RegExp(signal));
  }

  assert.match(view, /identify questions to investigate, not causes or diagnoses/);
  assert.match(view, /descriptive, not proof that the organisation caused the behaviour/);
  assert.match(view, /does not prove that no system gap exists/);
});

test("deeper analysis preserves independent small-cell suppression", async () => {
  const migration = await source("supabase/migrations/20260918123500_programme_outcomes_deeper_analysis.sql");

  assert.match(migration, /if v_member_count < 5 then/);
  assert.match(migration, /participants < 3/);
  assert.match(migration, /suppressedSmallThemeCount/);
  assert.match(migration, /revoke all on function public\.sponsor_cohort_deeper_analysis\(text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.sponsor_cohort_deeper_analysis\(text\) to authenticated/i);
});
