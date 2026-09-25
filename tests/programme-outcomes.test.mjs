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
  assert.match(access, /"PROGRAMME_OWNER"/);
  assert.match(route, /role === "SPONSOR_VIEWER" \|\| role === "PROGRAMME_OWNER"/);
  assert.match(route, /scopeType = organisationRole \? "COHORT" : "GLOBAL"/);
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
    "Did learners ask for help when they got stuck?",
  ]) {
    assert.match(view, new RegExp(question.replace(/[?]/g, "\\?")));
  }

  assert.match(view, /Completion/);
  assert.match(view, /Across this programme/);
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


test("organisation learning adds programme-design questions without exposing learner content", async () => {
  const [route, view, migration] = await Promise.all([
    source("app/api/staff/route.ts"),
    source("app/programme-outcomes-view.tsx"),
    source("supabase/migrations/20260925205000_programme_design_organisational_learning.sql"),
  ]);

  assert.match(route, /sponsor_cohort_organisational_learning/);
  assert.match(route, /organisationLearning:/);
  assert.match(view, /What the programme can learn/);
  assert.match(view, /What should the organisation learn from this programme\?/);
  assert.match(view, /Support follow-up/);
  assert.match(view, /Adaptation/);
  assert.match(view, /How confident can we be\?/);
  assert.match(view, /For the next programme/);
  assert.match(view, /Observe/);
  assert.match(view, /Try one clear change/);
  assert.match(view, /Check the next group/);

  assert.match(migration, /private\.can_view_sponsor_cohort/);
  assert.match(migration, /supportResponse/);
  assert.match(migration, /checkpointParticipants/);
  assert.match(migration, /repeatSituationParticipants/);
  assert.match(migration, /comparableCohorts/);
  assert.doesNotMatch(migration, /s\.summary/);
  assert.doesNotMatch(migration, /adjustment_summary/);
  assert.doesNotMatch(migration, /experiment_events\.notes/);
});

test("programme-design insight treats missing response and adaptation records as unknown, not failure", async () => {
  const view = await source("app/programme-outcomes-view.tsx");
  assert.match(view, /If a response is not recorded in BIS, that does not mean support did not happen/);
  assert.match(view, /BIS leaves the question open instead of treating missing information as failure/);
  assert.match(view, /not proof of why a result happened/);
});

test("organisation learning preserves causal restraint and baseline comparison language", async () => {
  const [view, migration] = await Promise.all([
    source("app/programme-outcomes-view.tsx"),
    source("supabase/migrations/20260925205000_programme_design_organisational_learning.sql"),
  ]);
  assert.match(view, /starting point for the next programme/);
  assert.match(view, /A comparison can show whether the pattern changed, but it does not prove what caused the change/);
  assert.match(migration, /descriptiveNotCausal/);
  assert.match(migration, /They do not prove why an outcome occurred or that BIS caused it/);
});


test("programme PDF carries the organisational learning layer", async () => {
  const pdf = await source("lib/programme-report-pdf.ts");
  assert.match(pdf, /What the programme can learn/);
  assert.match(pdf, /What should the team learn from this programme\?/);
  assert.match(pdf, /Support follow-up/);
  assert.match(pdf, /Learning for the next programme/);
  assert.match(pdf, /If a response is not recorded in BIS, that does not mean support did not happen/);
});


test("programme decision register connects evidence to a next-cycle organisational decision", async () => {
  const [view, route, migration, pdf] = await Promise.all([
    source("app/programme-outcomes-view.tsx"),
    source("app/api/staff/route.ts"),
    source("supabase/migrations/20260925224500_programme_decision_register.sql"),
    source("lib/programme-report-pdf.ts"),
  ]);

  assert.match(view, /Programme decisions/);
  assert.match(view, /What did the organisation decide to change\?/);
  assert.match(view, /What will the programme change\?/);
  assert.match(view, /What do we expect to observe next\?/);
  assert.match(view, /Use in decision/);
  assert.match(view, /reviewProgrammeDecision/);

  assert.match(route, /createProgrammeDecision/);
  assert.match(route, /reviewProgrammeDecision/);
  assert.match(route, /PROGRAMME_OWNER/);
  assert.match(route, /PROGRAMME_DECISION_CREATED/);
  assert.match(route, /PROGRAMME_DECISION_REVIEWED/);

  assert.match(migration, /enable row level security/);
  assert.match(migration, /programme_decisions_select/);
  assert.match(migration, /programme_decisions_insert/);
  assert.match(migration, /programme_decisions_update/);
  assert.doesNotMatch(migration, /grant delete/i);
  assert.match(migration, /PROGRAMME_OWNER/);

  assert.match(pdf, /Programme decisions/);
  assert.match(pdf, /Interpretation boundary/);
  assert.match(pdf, /does not prove that the programme change caused the result/);
});

test("programme owner is writable while sponsor viewer remains read only", async () => {
  const [access, shell, operations, route] = await Promise.all([
    source("lib/bis-access.ts"),
    source("app/workspace/staff-workspace-shell.tsx"),
    source("app/operations-view.tsx"),
    source("app/api/staff/route.ts"),
  ]);

  assert.match(access, /"PROGRAMME_OWNER"/);
  assert.match(shell, /roles\.includes\("PROGRAMME_OWNER"\)/);
  assert.match(operations, /Programme results · view only/);
  assert.match(operations, /Programme lead · decisions/);
  assert.match(route, /canManageProgrammeCohort/);
  assert.match(route, /role === "SPONSOR_VIEWER" \|\| role === "PROGRAMME_OWNER"/);
});

test("decision register never stores learner-level evidence fields", async () => {
  const migration = await source("supabase/migrations/20260925224500_programme_decision_register.sql");
  assert.doesNotMatch(migration, /learner_user_id/);
  assert.doesNotMatch(migration, /learner_email/);
  assert.doesNotMatch(migration, /reflection/);
  assert.doesNotMatch(migration, /experiment_notes/);
  assert.doesNotMatch(migration, /support_message/);
});
