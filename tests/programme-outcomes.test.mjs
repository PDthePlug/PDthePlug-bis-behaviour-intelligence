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
  assert.match(route, /Choose an active programme group for organisation reporting/);
  assert.match(route, /SPONSOR_VIEWER/);
});

test("sponsor snapshot is aggregate-only and delegates calculation to the protected RPC", async () => {
  const route = await source("app/api/staff/route.ts");
  const start = route.indexOf("async function sponsorSnapshot");
  const end = route.indexOf("async function safeguardingSnapshot");
  assert.ok(start >= 0 && end > start);
  const sponsor = route.slice(start, end);

  assert.match(sponsor, /rpc\("sponsor_cohort_outcomes"/);
  assert.match(sponsor, /rpc\("sponsor_cohort_deeper_analysis"/);
  assert.match(sponsor, /rpc\("sponsor_cohort_learning_summary"/);
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

test("programme outcomes answer useful organisation questions rather than only completion", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  for (const question of [
    "Are people moving from preparation into action?",
    "What did people expect—and what happened?",
    "Are people actually testing this in real life?",
    "How much can we responsibly say?",
    "What happened the next time?",
    "Did participants ask for help when they got stuck?",
  ]) {
    assert.match(view, new RegExp(question.replace(/[?]/g, "\\?")));
  }

  assert.match(view, /Completion/);
  assert.match(view, /Programme context/);
  assert.match(view, /not enough evidence yet/i);
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
  assert.match(view, /Grouped broadly to protect privacy/);
});

test("deeper analysis is an explicit expandable organisation layer", async () => {
  const [view, css] = await Promise.all([
    source("app/programme-outcomes-view.tsx"),
    source("app/programme-outcomes-view.css"),
  ]);

  assert.match(view, /<details className="outcomes-deeper-analysis">/);
  assert.match(view, /What were people exploring\?/);
  assert.match(view, /What people explored/);
  assert.match(view, /What to look at next/);
  assert.match(view, /Worth checking/);
  assert.match(css, /\.outcomes-deeper-analysis/);
  assert.match(css, /\.opportunity-list/);
});

test("system opportunity signals remain evidence-based review questions rather than causal claims", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  for (const signal of [
    "People reached the test but did not start",
    "Not enough chances to test the behaviour",
    "What people expected and what happened are far apart",
    "Too few repeat situations",
    "People are asking for help",
    "We need clearer context",
  ]) {
    assert.match(view, new RegExp(signal));
  }

  assert.match(view, /These patterns point to useful questions/);
  assert.match(view, /they do not prove why it happened/);
  assert.match(view, /does not prove that there is no gap/);
});

test("deeper analysis preserves independent small-cell suppression", async () => {
  const migration = await source("supabase/migrations/20260918123500_programme_outcomes_deeper_analysis.sql");

  assert.match(migration, /if v_member_count < 5 then/);
  assert.match(migration, /participants < 3/);
  assert.match(migration, /suppressedSmallThemeCount/);
  assert.match(migration, /revoke all on function public\.sponsor_cohort_deeper_analysis\(text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.sponsor_cohort_deeper_analysis\(text\) to authenticated/i);
});


test("organisation experience hides implementation language and explanatory product copy", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  for (const phrase of [
    "What this changes",
    "Signal coverage",
    "Experiment landscape",
    "System opportunities",
    "structured impact-domain tags",
    "Question for the sponsor",
    "Sponsor View",
    "Aggregate reporting only",
    "prediction calibration",
  ]) {
    assert.doesNotMatch(view, new RegExp(phrase, "i"));
  }

  assert.match(view, /Privacy and reporting boundaries/);
  assert.match(view, /Areas people were exploring/);
  assert.match(view, /What may be worth checking\?/);
});

test("organisation outcome labels use plain language", async () => {
  const view = await source("app/programme-outcomes-view.tsx");

  for (const phrase of [
    "Expectation vs reality",
    "Real-world testing",
    "What we can say",
    "Next time",
    "People who asked for help",
    "Real situations",
  ]) {
    assert.match(view, new RegExp(phrase));
  }

  assert.doesNotMatch(view, /Eligible opportunities/);
  assert.doesNotMatch(view, /Cohort request rate/);
  assert.doesNotMatch(view, /Changed toward protocol/);
});


test("organisation reporting includes the learning journey beyond the experiment", async () => {
  const [view, migration] = await Promise.all([
    source("app/programme-outcomes-view.tsx"),
    source("supabase/migrations/20260918152000_programme_outcomes_learning_summary.sql"),
  ]);

  for (const label of [
    "Learning journey",
    "Recurring challenges",
    "Growth signals",
    "What is changing while the programme is happening?",
    "What can the organisation do with this information?",
  ]) {
    assert.match(view, new RegExp(label.replace(/[?]/g, "\\?")));
  }

  assert.match(migration, /handbook_progress/);
  assert.match(migration, /HAB\.CONTROL\.PRE/);
  assert.match(migration, /HAB\.CONTROL\.POST/);
  assert.match(migration, /HAB\.EQUATION\.CONFIDENCE_PRE/);
  assert.match(migration, /HAB\.EQUATION\.CONFIDENCE_POST/);
  assert.match(migration, /Never to Always/);
  assert.match(migration, /frequent_count >= 3/);
  assert.match(migration, /if v_member_count < 5 then/);
});

test("learning summary never returns private free-text response content", async () => {
  const migration = await source("supabase/migrations/20260918152000_programme_outcomes_learning_summary.sql");

  for (const privateField of [
    "HAB.CUE.TEXT",
    "HAB.ROUTINE.TEXT",
    "HAB.EMOTION.TEXT",
    "HAB.EQUATION.TEXT",
    "HAB.I9.FUTURE_LETTER",
  ]) {
    assert.doesNotMatch(migration, new RegExp(privateField.replace(/[.]/g, "\\.")));
  }
  assert.match(migration, /Free-text reflections are excluded/);
  assert.doesNotMatch(migration, /jsonb_build_object\([^)]*'value'/s);
});

test("privacy explanation is optional instead of occupying the report", async () => {
  const view = await source("app/programme-outcomes-view.tsx");
  assert.match(view, /<details className="outcomes-privacy-disclosure">/);
  assert.match(view, /Privacy and reporting boundaries/);
  assert.doesNotMatch(view, /className="outcomes-privacy"/);
});
