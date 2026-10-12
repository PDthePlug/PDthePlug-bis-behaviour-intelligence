import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildProgrammeReport } from "../lib/programme-intelligence.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20261012190000_facilitator_development_projection.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/facilitator-development/route.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/workspace/staff-workspace-shell.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/workspace/facilitator-learner-detail.tsx", import.meta.url), "utf8");

function between(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

test("individual development projection is facilitator-only and excludes private learner content", () => {
  const access = between(
    migration,
    "create or replace function private.can_view_facilitator_learner_development",
    "create or replace function public.bis_facilitator_learner_development_evidence",
  );
  const projection = between(
    migration,
    "create or replace function public.bis_facilitator_learner_development_evidence",
    "-- Replace the existing aggregate competency summary",
  );

  assert.match(access, /r\.role = 'FACILITATOR'/);
  assert.doesNotMatch(access, /SPONSOR_VIEWER|PROGRAMME_OWNER/);
  assert.match(projection, /e\.sensitivity in \('P0','P1','P2'\)/);
  assert.doesNotMatch(projection, /'value'\s*,\s*e\.value|e\.value\s+as/);
  assert.doesNotMatch(projection, /(?:from|join)\s+(?:public\.)?(?:companion_turns|memory_items|hypotheses|experiment_events)\b/i);
  assert.match(projection, /Response wording, reflections, hypotheses, experiment notes, Companion content and P3 evidence are excluded/);
});

test("facilitator API builds the same governed development model without widening roles", () => {
  assert.match(route, /requireAnyRole\(roles, \["FACILITATOR", "SYSTEM_ADMIN"\]\)/);
  assert.match(route, /buildLearnerDevelopmentProfile/);
  assert.match(route, /privateResponseValuesIncluded:\s*false/);
  assert.match(route, /p3EvidenceIncluded:\s*false/);
  assert.doesNotMatch(route, /SPONSOR_VIEWER|PROGRAMME_OWNER/);
});

test("opening a learner leaves the repetitive operations detail and enters the development surface", () => {
  assert.match(shell, /selectedLearnerId/);
  assert.match(shell, /<FacilitatorLearnerDetail/);
  assert.match(detail, /<FacilitatorLearnerDevelopment/);
  assert.match(detail, /These operational records provide context\. They are not the learner&apos;s development result\./);
  assert.match(detail, /Human follow-up stays separate from the learner&apos;s development evidence\./);
});

test("programme findings describe privacy-safe progression, not just current counts", () => {
  const report = buildProgrammeReport({
    participantCount: 10,
    minimumReportableCohortSize: 5,
    evidenceFlow: {
      suppressed: false,
      runtimeMode: "DYNAMIC",
      minimumReportableCohortSize: 5,
      minimumReportableCellSize: 3,
      totals: { startedExperiment: 0, completed: 0, recordedResponses: 12, anchoredMeasures: 6 },
      stages: [],
    },
    competencySummary: {
      status: "AVAILABLE",
      reportClassification: { id: "COHORT_LEARNING_REPORT" },
      participantCount: 10,
      competencies: [{
        competencyId: "TEST-COMPETENCY",
        title: "Evidence-informed action",
        reportableParticipants: 7,
        participantsWithRecordedProgression: 4,
        externalFrameworkAreas: [],
        nextQuestion: "What should learners practise next?",
        distribution: [
          { code: "NOTICE", label: "Notices", count: 3 },
          { code: "APPLY", label: "Applies", count: 4 },
        ],
      }],
    },
  });

  const development = report.insights.find(item => item.id === "competency-evidence-TEST-COMPETENCY");
  assert.ok(development);
  assert.match(development.title, /development and progression/i);
  assert.match(development.observation, /4 learners.*later mapped evidence supporting a higher defined stage/i);
  assert.match(development.boundary, /not a claim that the programme caused change/i);
});
