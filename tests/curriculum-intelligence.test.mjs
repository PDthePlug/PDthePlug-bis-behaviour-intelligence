import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMPETENCY_PROGRESSION,
  REPORT_EVIDENCE_CLASSIFICATIONS,
  buildCompetencyProgressSummary,
  classifyCompetencyProgress,
} from "../lib/curriculum-intelligence.mjs";

const root = new URL("..", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const sourceEvent = (kind, extra = {}) => ({
  kind,
  qualifies: true,
  sourceRefs: ["AC:G9:L38"],
  evidenceRefs: [`E:${kind}`],
  ...extra,
});

test("ingests the complete Applied Commerce Grade 8-12 lesson spine", async () => {
  const source = await readJson("content/curriculum/applied-commerce/source-register.json");
  const index = await readJson("content/curriculum/applied-commerce/lesson-index.json");

  assert.equal(index.lessonCount, 395);
  assert.deepEqual(index.grades.map((grade) => [grade.grade, grade.lessonCount]), [
    [8, 80], [9, 75], [10, 80], [11, 80], [12, 80],
  ]);
  assert.equal(source.books.reduce((sum, book) => sum + book.lessonCount, 0), 395);

  const grade9 = index.grades.find((grade) => grade.grade === 9);
  const lesson38 = grade9.terms.flatMap((term) => term.lessons).find((lesson) => lesson.lesson === 38);
  assert.equal(lesson38.title, "TIME MANAGEMENT");
  assert.deepEqual(
    lesson38.authoredCompetencyMappings.map((mapping) => mapping.code),
    ["LO-G9-T3-04", "BS-G9-T3-04", "EMS-G9-T3-04"],
  );
  assert.match(source.ingestionContract.externalAlignment, /No official CAPS\/DBE approval/);
});

test("maps every BIS catalogue Lab to Applied Commerce ancestry without manufacturing Failure source", async () => {
  const [catalogue, atlas, index] = await Promise.all([
    readJson("lib/bis-catalogue.json"),
    readJson("content/curriculum/applied-commerce/concept-atlas.json"),
    readJson("content/curriculum/applied-commerce/lesson-index.json"),
  ]);

  assert.equal(atlas.labs.length, 34);
  assert.deepEqual(atlas.labs.map((lab) => lab.code), catalogue.modules.map((module) => module.code));

  const known = new Set(index.grades.flatMap((grade) =>
    grade.terms.flatMap((term) => term.lessons.map((lesson) => `AC:G${grade.grade}:L${lesson.lesson}`))
  ));
  for (const lab of atlas.labs) {
    assert.ok(lab.appliedCommerceAnchors.length > 0, `${lab.code} has no Applied Commerce ancestry`);
    for (const anchor of lab.appliedCommerceAnchors) assert.ok(known.has(anchor), `${lab.code}: unknown ${anchor}`);
  }

  const failure = atlas.labs.find((lab) => lab.code === "FAI");
  assert.equal(failure.bisSourceStatus, "PENDING_BIS_SOURCE");
  assert.ok(failure.appliedCommerceAnchors.includes("AC:G9:L42"));
});

test("competency progression refuses to turn self-report or completion into competence", () => {
  assert.equal(classifyCompetencyProgress({ introduced: false, evidence: [] }), "NOT_EVIDENCED");
  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: [] }), "INTRODUCED");

  const selfReportOnly = [
    sourceEvent("BASELINE"),
    sourceEvent("SELF_REPORT"),
    sourceEvent("CONFIDENCE"),
    sourceEvent("COMPLETION"),
  ];
  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: selfReportOnly }), "INTRODUCED");

  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: [sourceEvent("LEARNING_CHECK")] }), "EXPLAINED");
  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: [sourceEvent("GUIDED_APPLICATION")] }), "APPLIED_WITH_SUPPORT");
  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: [sourceEvent("ASSESSED_TASK")] }), "DEMONSTRATED_IN_TASK");
  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: [sourceEvent("OBSERVATION")] }), "TESTED_IN_CONTEXT");
});

test("adaptation, transfer and sustained stages require stronger evidence", () => {
  assert.equal(classifyCompetencyProgress({
    introduced: true,
    evidence: [sourceEvent("INTERPRETATION")],
  }), "INTRODUCED");

  assert.equal(classifyCompetencyProgress({
    introduced: true,
    evidence: [sourceEvent("INTERPRETATION"), sourceEvent("REVISION")],
  }), "REVIEWED_AND_ADAPTED");

  assert.equal(classifyCompetencyProgress({
    introduced: true,
    evidence: [sourceEvent("TRANSFER", { cycleId: "cycle-1" })],
  }), "TRANSFERRED");

  assert.equal(classifyCompetencyProgress({
    introduced: true,
    evidence: [
      sourceEvent("TRANSFER", { cycleId: "cycle-1", longitudinal: true }),
      sourceEvent("TRANSFER", { cycleId: "cycle-2", longitudinal: true }),
    ],
  }), "SUSTAINED");

  const missingProvenance = { kind: "ASSESSED_TASK", qualifies: true, sourceRefs: [] };
  assert.equal(classifyCompetencyProgress({ introduced: true, evidence: [missingProvenance] }), "INTRODUCED");
});

test("portfolio summaries expose progression and boundaries without raw answers", () => {
  const summary = buildCompetencyProgressSummary({
    competencyId: "TIM.C7",
    label: "Review evidence and adapt",
    introduced: true,
    evidence: [
      sourceEvent("INTERPRETATION", { evidenceRefs: ["E:review"] }),
      sourceEvent("REVISION", { evidenceRefs: ["E:revision"] }),
    ],
  });

  assert.equal(summary.stage, "REVIEWED_AND_ADAPTED");
  assert.deepEqual(summary.evidenceRefs, ["E:review", "E:revision"]);
  assert.match(summary.nextStep, /transfer/i);
  assert.match(summary.boundary, /does not guarantee/i);
  assert.equal("rawResponse" in summary, false);
  assert.ok(COMPETENCY_PROGRESSION.includes(summary.stage));
  assert.ok(REPORT_EVIDENCE_CLASSIFICATIONS.includes("LONGITUDINAL_PORTFOLIO"));
});

test("Time Lab is the first ten-day curriculum blueprint under the new instructional standard", async () => {
  const time = await readJson("content/curriculum/time/time-lab-curriculum.json");

  assert.equal(time.labCode, "TIM");
  assert.equal(time.programmeDays, 10);
  assert.equal(time.guidedSessionMinutes, 45);
  assert.equal(time.labPhaseAMinutes, 90);
  assert.equal(time.days.length, 10);

  for (const day of time.days) {
    assert.equal(day.beats.reduce((sum, beat) => sum + beat.minutes, 0), 45, `Day ${day.day}`);
    assert.ok(day.competencies.length > 0, `Day ${day.day} has no competency target`);
    assert.ok(day.sourceRefs.length > 0, `Day ${day.day} has no source provenance`);
    assert.ok(day.learnerEvidence.length > 0, `Day ${day.day} has no evidence product`);
  }

  assert.equal(time.days[2].separateLabPhaseAMinutes, 90);
  assert.match(time.days[2].facilitatorFocus, /Do not pre-empt the Lab revelation/);
  assert.equal(time.days[3].phase, "EXPLAIN");
  assert.ok(time.days[7].learnerEvidence.some((item) => item.reportClass === "REVIEW_ADAPTATION"));
  assert.ok(time.days[8].learnerEvidence.some((item) => item.reportClass === "TRANSFER"));
  assert.ok(time.days[9].learnerEvidence.some((item) => item.reportClass === "LONGITUDINAL_PORTFOLIO"));
});
