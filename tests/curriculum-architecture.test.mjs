import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  bindEvidenceToCompetencies,
  buildCompetencyProgression,
  externalFrameworkAreas,
  comparableChange,
  highestSupportedProgression,
  workbookResponsesToEvidenceEvents,
} from "../lib/curriculum-competency.mjs";
import { reportClassification, reportClassificationIds } from "../lib/report-classification.mjs";
import {
  buildCohortCompetencySummary,
  buildLearnerCompetencyReport,
  buildLongitudinalCompetencyPathway,
} from "../lib/competency-reporting.mjs";
import { buildProgrammeReport } from "../lib/programme-intelligence.mjs";

const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

test("Applied Commerce structural ingestion covers all 395 lessons", async () => {
  const index = await json("content/curriculum/applied-commerce/lesson-index.json");
  assert.equal(index.totals.grades, 5);
  assert.equal(index.totals.lessons, 395);
  assert.deepEqual(index.grades.map(g => [g.grade, g.lessonCount]), [[8,80],[9,75],[10,80],[11,80],[12,80]]);
  for (const grade of index.grades) {
    assert.equal(grade.lessonRefs.length, grade.lessonCount);
    assert.equal(grade.lessonRefs[0].lesson, 1);
    assert.equal(grade.lessonRefs.at(-1).lesson, grade.lessonCount);
  }
});

test("Concept Atlas is internally referential and source refs stay inside grade bounds", async () => {
  const [atlas, framework, index] = await Promise.all([
    json("content/curriculum/applied-commerce/concept-atlas.json"),
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/applied-commerce/lesson-index.json"),
  ]);
  const competencyIds = new Set(framework.competencies.map(c => c.id));
  const maxByGrade = new Map(index.grades.map(g => [g.grade, g.lessonCount]));
  assert.equal(new Set(atlas.concepts.map(c => c.id)).size, atlas.concepts.length);
  assert.ok(atlas.concepts.length >= 50);
  for (const concept of atlas.concepts) {
    assert.ok(concept.competencies.length);
    concept.competencies.forEach(id => assert.ok(competencyIds.has(id), `Unknown competency ${id}`));
    for (const ref of concept.sources) {
      const match = /^AC\.G(\d+)\.L(\d+)$/.exec(ref);
      assert.ok(match, `Invalid source ref ${ref}`);
      const grade = Number(match[1]), lesson = Number(match[2]);
      assert.ok(maxByGrade.has(grade), `Unknown grade ${grade}`);
      assert.ok(lesson >= 1 && lesson <= maxByGrade.get(grade), `Out-of-range source ref ${ref}`);
    }
  }
});

test("All 34 catalogue Labs have curriculum ancestry exactly once", async () => {
  const [ancestry, atlas, catalogue, framework] = await Promise.all([
    json("content/curriculum/applied-commerce/lab-ancestry.json"),
    json("content/curriculum/applied-commerce/concept-atlas.json"),
    json("lib/bis-catalogue.json"),
    json("content/curriculum/applied-commerce/competency-framework.json"),
  ]);
  const catalogueCodes = catalogue.modules.map(module => module.code).sort();
  const ancestryCodes = ancestry.labs.map(lab => lab.labCode).sort();
  assert.equal(ancestry.labs.length, 34);
  assert.deepEqual(ancestryCodes, catalogueCodes);
  const conceptIds = new Set(atlas.concepts.map(c => c.id));
  const competencyIds = new Set(framework.competencies.map(c => c.id));
  for (const lab of ancestry.labs) {
    assert.ok(lab.concepts.length >= 3, `${lab.labCode} needs meaningful ancestry`);
    lab.concepts.forEach(link => assert.ok(conceptIds.has(link.conceptId), `Unknown concept ${link.conceptId}`));
    lab.primaryCompetencies.forEach(id => assert.ok(competencyIds.has(id), `Unknown competency ${id}`));
  }
  assert.equal(ancestry.labs.find(lab => lab.labCode === "FAI").ancestryStatus, "CURRICULUM_ANCESTRY_READY_LAB_SOURCE_PENDING");
});

test("Instructional standard preserves ten touchpoints and the separate Day 3 Lab handover", async () => {
  const standard = await json("content/curriculum/instructional-standard.json");
  assert.equal(standard.invariantProgrammeModel.length, 10);
  assert.deepEqual(standard.invariantProgrammeModel.map(x => x.touchpoint), [1,2,3,4,5,6,7,8,9,10]);
  assert.match(standard.invariantProgrammeModel[2].boundary, /separate facilitated experience/i);
  assert.match(standard.invariantProgrammeModel[9].boundary, /not another theory chapter/i);
});

test("Time is a ten-day curriculum/evidence reference implementation", async () => {
  const [time, framework, atlas] = await Promise.all([
    json("content/curriculum/time/time-instructional-blueprint-v2.json"),
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/applied-commerce/concept-atlas.json"),
  ]);
  assert.equal(time.days.length, 10);
  assert.deepEqual(time.days.map(day => day.day), [1,2,3,4,5,6,7,8,9,10]);
  assert.match(time.programmeShape.day3LabBoundary, /separate facilitated Phase A/i);
  const competencies = new Set(framework.competencies.map(c => c.id));
  const concepts = new Set(atlas.concepts.map(c => c.id));
  for (const day of time.days) {
    assert.ok(day.knowledgeOutcome);
    assert.ok(day.capabilityOutcome);
    assert.ok(day.evidence.length);
    assert.ok(day.minutes.length);
    day.competencies.forEach(id => assert.ok(competencies.has(id), `Unknown Time competency ${id}`));
    day.concepts.forEach(id => assert.ok(concepts.has(id), `Unknown Time concept ${id}`));
  }
  assert.ok(time.days[2].evidence.some(e => e.class === "PREDICTION"));
  assert.ok(time.days[2].evidence.some(e => e.class === "PLAN"));
  assert.ok(time.days[8].evidence.some(e => e.class === "TRANSFER"));
  assert.ok(time.days[9].evidence.some(e => e.class === "TRANSFER"));
});

test("report classifications distinguish individual, support, aggregate and longitudinal uses", async () => {
  const reports = await json("content/curriculum/report-classifications.json");
  const ids = new Set(reports.classifications.map(r => r.id));
  for (const required of [
    "LEARNER_PROGRESS_REPORT","COMPETENCY_EVIDENCE_REPORT","EVIDENCE_PORTFOLIO",
    "FACILITATOR_SUPPORT_REPORT","COHORT_LEARNING_REPORT","SPONSOR_OUTCOME_REPORT",
    "IMPLEMENTATION_QUALITY_REPORT","LONGITUDINAL_PATHWAY_REPORT",
  ]) assert.ok(ids.has(required), `Missing report classification ${required}`);
});

test("competency progression never turns unverified evidence into capability", () => {
  const result = highestSupportedProgression([
    { id:"x", competencyId:"AC-C03", class:"TRANSFER", provenanceStatus:"UNVERIFIED", secondContext:true },
  ]);
  assert.equal(result.code, "NOT_YET_EVIDENCED");
});

test("competency progression requires the evidence chain for test-and-revise", () => {
  const result = highestSupportedProgression([
    { id:"p", competencyId:"AC-C04", class:"PREDICTION", provenanceStatus:"VERIFIED", contextId:"time" },
    { id:"o", competencyId:"AC-C04", class:"OBSERVATION", provenanceStatus:"VERIFIED", contextId:"time" },
    { id:"i", competencyId:"AC-C04", class:"INTERPRETATION", provenanceStatus:"VERIFIED", contextId:"time" },
    { id:"r", competencyId:"AC-C04", class:"PLAN", provenanceStatus:"VERIFIED", contextId:"time", revision:true },
  ]);
  assert.equal(result.code, "TEST_AND_REVISE");
});

test("transfer requires a second or explicitly marked transfer context", () => {
  const same = highestSupportedProgression([
    { id:"t", competencyId:"AC-C15", class:"TRANSFER", provenanceStatus:"VERIFIED", contextId:"time" },
  ]);
  assert.notEqual(same.code, "TRANSFER");
  const second = highestSupportedProgression([
    { id:"a", competencyId:"AC-C15", class:"LEARNING_CHECK", provenanceStatus:"VERIFIED", contextId:"time" },
    { id:"b", competencyId:"AC-C15", class:"TRANSFER", provenanceStatus:"VERIFIED", contextId:"study", secondContext:true },
  ]);
  assert.equal(second.code, "TRANSFER");
});

test("pre/post comparisons require a stable task family", () => {
  assert.equal(comparableChange({pre:{questionFamily:"Q1"},post:{questionFamily:"Q1"}}).comparable, true);
  assert.equal(comparableChange({pre:{questionFamily:"Q1"},post:{questionFamily:"Q2"}}).comparable, false);
});

test("progression summaries remain per competency rather than a global maturity score", () => {
  const summaries = buildCompetencyProgression({
    competencies:[{id:"AC-C03",title:"Evidence"},{id:"AC-C04",title:"Behaviour"}],
    evidence:[{id:"e",competencyId:"AC-C03",class:"LEARNING_CHECK",provenanceStatus:"VERIFIED",contextId:"class"}],
  });
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].progression.code, "EXPLAIN");
  assert.equal(summaries[1].progression.code, "NOT_YET_EVIDENCED");
  assert.equal("globalMaturityScore" in summaries, false);
});


test("runtime report classification registry matches the architecture classifications", async () => {
  const reports = await json("content/curriculum/report-classifications.json");
  assert.deepEqual(reportClassificationIds().sort(), reports.classifications.map(item => item.id).sort());
  assert.equal(reportClassification("SPONSOR_OUTCOME_REPORT").scope, "aggregate_programme");
  assert.equal(reportClassification("EVIDENCE_PORTFOLIO").scope, "individual_longitudinal");
});

test("programme intelligence explicitly identifies the report class before findings", () => {
  const report = buildProgrammeReport({
    cohort:{name:"Specimen",labCode:"TIM",labVersion:"1"},
    participantCount:6,
    suppressed:false,
    minimumReportableCohortSize:5,
    evidenceFlow:{runtimeMode:"DYNAMIC",suppressed:false,totals:{startedExperiment:0,completed:0},stages:[]},
  });
  assert.equal(report.reportClassification.id, "SPONSOR_OUTCOME_REPORT");
  assert.equal(report.reportClassification.claimMode, "DESCRIPTIVE_OUTCOME_EVIDENCE");
});


test("Time authored anchors deterministically bind evidence to competencies", async () => {
  const mapping = await json("content/curriculum/time/time-competency-evidence-map.json");
  const rows = bindEvidenceToCompetencies({
    bindings: mapping.bindings,
    events: [
      { id:"obs", anchor:"TIM.D6.REAL_WORLD_APPLICATION", provenanceStatus:"VERIFIED", contextId:"time" },
      { id:"transfer", anchor:"TIM.D10.TRANSFER_DEMONSTRATION", provenanceStatus:"VERIFIED", contextId:"study", secondContext:true },
    ],
  });
  assert.ok(rows.some(row => row.competencyId === "AC-C04" && row.class === "OBSERVATION"));
  assert.ok(rows.some(row => row.competencyId === "AC-C15" && row.class === "TRANSFER" && row.curriculumMappingStatus === "AUTHORED"));
});


test("DBE crosswalk covers every internal competency without claiming certification", async () => {
  const [crosswalk, framework] = await Promise.all([
    json("content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json"),
    json("content/curriculum/applied-commerce/competency-framework.json"),
  ]);
  assert.equal(crosswalk.framework.id, "DBE-BECF-2024");
  assert.match(crosswalk.framework.sourceBoundary, /does not represent DBE approval/i);
  assert.deepEqual(
    crosswalk.mappings.map(item => item.competencyId).sort(),
    framework.competencies.map(item => item.id).sort(),
  );
  assert.ok(crosswalk.reportingLanguage.prohibited.some(line => /certified/i.test(line)));
});

test("external framework tags require reportable BIS competency evidence first", async () => {
  const crosswalk = await json("content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json");
  const none = externalFrameworkAreas({
    competencyId:"AC-C03",
    evidenceCount:0,
    progression:{level:0,code:"NOT_YET_EVIDENCED"},
  }, crosswalk);
  assert.deepEqual(none, []);
  const mapped = externalFrameworkAreas({
    competencyId:"AC-C03",
    evidenceCount:2,
    progression:{level:2,code:"EXPLAIN"},
  }, crosswalk);
  assert.ok(mapped.includes("Critical thinking"));
  assert.ok(mapped.includes("Metacognition"));
});


test("learner competency report turns Time evidence into progression, evidence and next pathway", async () => {
  const [framework, mapping, crosswalk] = await Promise.all([
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/time/time-competency-evidence-map.json"),
    json("content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json"),
  ]);
  const report = buildLearnerCompetencyReport({
    learnerId:"learner-1",
    labCode:"TIM",
    competencies:framework.competencies,
    bindings:mapping.bindings,
    externalCrosswalk:crosswalk,
    events:[
      {id:"p",anchor:"TIM.D3.PREDICTION",provenanceStatus:"VERIFIED",contextId:"time",recordedAt:"2026-10-01T10:00:00Z"},
      {id:"o",anchor:"TIM.D6.REAL_WORLD_APPLICATION",provenanceStatus:"VERIFIED",contextId:"time",recordedAt:"2026-10-04T10:00:00Z"},
      {id:"i",anchor:"TIM.D7.BARRIER_DIAGNOSIS",provenanceStatus:"VERIFIED",contextId:"time",recordedAt:"2026-10-05T10:00:00Z"},
      {id:"r",anchor:"TIM.D7.JUSTIFIED_ADJUSTMENT",provenanceStatus:"VERIFIED",contextId:"time",recordedAt:"2026-10-05T10:05:00Z"},
      {id:"review",anchor:"TIM.D9.FINAL_REVIEW",provenanceStatus:"VERIFIED",contextId:"time",recordedAt:"2026-10-09T10:00:00Z"},
      {id:"t",anchor:"TIM.D10.TRANSFER_DEMONSTRATION",provenanceStatus:"VERIFIED",contextId:"study",recordedAt:"2026-10-10T10:00:00Z",secondContext:true},
    ],
  });
  assert.equal(report.reportClassification.id,"COMPETENCY_EVIDENCE_REPORT");
  assert.equal(report.status,"AVAILABLE");
  const behaviour=report.competencies.find(item=>item.competencyId==="AC-C04");
  assert.equal(behaviour.progression.code,"TEST_AND_REVISE");
  assert.ok(behaviour.progressionPath.length >= 2);
  assert.match(behaviour.nextEvidenceNeeded,/different context/i);
  const transfer=report.competencies.find(item=>item.competencyId==="AC-C15");
  assert.equal(transfer.progression.code,"TRANSFER");
  assert.ok(transfer.externalFrameworkAreas.includes("Metacognition"));
  assert.doesNotMatch(JSON.stringify(report),/globalMaturityScore|employability rating":\s*[0-9]/i);
});

test("cohort competency summary preserves privacy cells and never ranks learners", async () => {
  const participantReports = Array.from({length:6},(_,index)=>({
    learnerId:`L${index+1}`,
    competencies:[{
      competencyId:"AC-C03",title:"Evidence and accurate thinking",reportable:true,
      progression:{level:index<3?2:3,code:index<3?"EXPLAIN":"APPLY"},
      change:{levelDifference:index<4?1:0},
      externalFrameworkAreas:["Critical thinking","Metacognition"],
    }],
  }));
  const summary=buildCohortCompetencySummary({participantReports});
  assert.equal(summary.status,"AVAILABLE");
  assert.equal(summary.reportClassification.id,"COHORT_LEARNING_REPORT");
  const competency=summary.competencies[0];
  assert.equal(competency.distribution.find(row=>row.code==="EXPLAIN").count,3);
  assert.equal(competency.distribution.find(row=>row.code==="APPLY").count,3);
  assert.equal("rank" in competency,false);
  const suppressed=buildCohortCompetencySummary({participantReports:participantReports.slice(0,4)});
  assert.equal(suppressed.status,"SUPPRESSED");
  assert.deepEqual(suppressed.competencies,[]);
});

test("longitudinal pathway shows per-competency evidence broadening without a global maturity score", () => {
  const make=(level,code)=>({competencies:[{competencyId:"AC-C03",title:"Evidence",progression:{level,code},label:code,evidenceCount:level}]});
  const report=buildLongitudinalCompetencyPathway({
    learnerId:"L1",
    snapshots:[
      {at:"2026-01-01",labCode:"HAB",report:make(2,"EXPLAIN")},
      {at:"2026-06-01",labCode:"TIM",report:make(4,"TEST_AND_REVISE")},
    ],
  });
  assert.equal(report.reportClassification.id,"LONGITUDINAL_PATHWAY_REPORT");
  assert.equal(report.competencies[0].direction,"BROADER_EVIDENCE");
  assert.doesNotMatch(JSON.stringify(report),/globalMaturityScore/i);
});


test("sponsor report can surface privacy-safe competency progression without a maturity score", () => {
  const report=buildProgrammeReport({
    cohort:{name:"Time cohort",labCode:"TIM",labVersion:"1"},
    participantCount:6,suppressed:false,minimumReportableCohortSize:5,
    evidenceFlow:{runtimeMode:"DYNAMIC",suppressed:false,totals:{startedExperiment:6,completed:6},stages:[]},
    competencySummary:{
      status:"AVAILABLE",
      reportClassification:{id:"COHORT_LEARNING_REPORT"},
      participantCount:6,
      competencies:[{
        competencyId:"AC-C03",title:"Evidence and accurate thinking",
        reportableParticipants:6,participantsWithRecordedProgression:4,
        distribution:[
          {code:"NOT_YET_EVIDENCED",label:"Not yet evidenced",count:0},
          {code:"NOTICE",label:"Notices",count:0},
          {code:"EXPLAIN",label:"Explains",count:3},
          {code:"APPLY",label:"Applies",count:3},
          {code:"TEST_AND_REVISE",label:"Tests and revises",count:null,suppressed:true},
          {code:"TRANSFER",label:"Transfers",count:0},
        ],
        externalFrameworkAreas:["Critical thinking","Metacognition"],
        nextQuestion:"Which transfer task would add useful next evidence?",
      }],
    },
  });
  const insight=report.insights.find(item=>item.id==="competency-evidence-AC-C03");
  assert.ok(insight);
  assert.match(insight.observation,/6 of 6/);
  assert.match(insight.interpretation,/DBE competency areas/);
  assert.match(insight.boundary,/does not rank learners/);
  const chart=report.charts.find(item=>item.id==="competency-AC-C03");
  assert.equal(chart.rows.find(row=>row.label==="Tests and revises").value,null);
  assert.equal(Object.prototype.hasOwnProperty.call(report, "globalMaturityScore"), false);
  assert.doesNotMatch(JSON.stringify(report.insights.map(item => item.observation)),/leaderboard|maturity score/i);
});


test("saved authored workbook tasks become anchor-only evidence without exposing private answers", async () => {
  const evidenceMap = await json("content/curriculum/time/time-competency-evidence-map.json");
  const events = workbookResponsesToEvidenceEvents({
    responses: {
      "TIM.WB.SCHOOL.DAY3.PREDICTION": {
        value: "private learner prediction",
        evidenceAnchor: "TIM.D3.PREDICTION",
        semanticFieldId: "TIM.WB.SCHOOL.DAY3.PREDICTION",
        updatedAt: "2026-10-07T08:00:00.000Z",
      },
    },
    bindings: evidenceMap.bindings,
    labCode: "TIM",
    contentReleaseId: "TIM:school:2.0:test",
    contextId: "time-primary",
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].anchor, "TIM.D3.PREDICTION");
  assert.equal(events[0].provenanceStatus, "VERIFIED");
  assert.equal(events[0].privacyClass, "P3");
  assert.equal(Object.prototype.hasOwnProperty.call(events[0], "value"), false);
});

test("an answered rubric task remains pending until assessment verifies the authored anchor", async () => {
  const evidenceMap = await json("content/curriculum/time/time-competency-evidence-map.json");
  const pending = workbookResponsesToEvidenceEvents({
    responses: [{
      semanticFieldId: "TIM.WB.SCHOOL.DAY4.EXPLANATION",
      evidenceAnchor: "TIM.D4.WORKING_EXPLANATION",
      value: "private explanation",
      updatedAt: "2026-10-07T09:00:00.000Z",
    }],
    bindings: evidenceMap.bindings,
    contextId: "time-primary",
  });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].provenanceStatus, "PENDING_ASSESSMENT");

  const mappedPending = bindEvidenceToCompetencies({ events: pending, bindings: evidenceMap.bindings });
  assert.equal(highestSupportedProgression(mappedPending).code, "NOT_YET_EVIDENCED");

  const verified = workbookResponsesToEvidenceEvents({
    responses: [{
      semanticFieldId: "TIM.WB.SCHOOL.DAY4.EXPLANATION",
      evidenceAnchor: "TIM.D4.WORKING_EXPLANATION",
      value: "private explanation",
      updatedAt: "2026-10-07T09:00:00.000Z",
    }],
    bindings: evidenceMap.bindings,
    contextId: "time-primary",
    verifiedAnchors: ["TIM.D4.WORKING_EXPLANATION"],
  });
  const mappedVerified = bindEvidenceToCompetencies({ events: verified, bindings: evidenceMap.bindings });
  assert.equal(mappedVerified.every(item => item.provenanceStatus === "VERIFIED"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(verified[0], "value"), false);
});

test("transfer tasks cannot become transfer evidence from completion alone", async () => {
  const evidenceMap = await json("content/curriculum/time/time-competency-evidence-map.json");
  const answered = workbookResponsesToEvidenceEvents({
    responses: [{
      semanticFieldId: "TIM.WB.SCHOOL.DAY9.SECOND_PATTERN",
      evidenceAnchor: "TIM.D9.SECOND_PATTERN",
      value: "private second pattern",
      updatedAt: "2026-10-07T10:00:00.000Z",
      secondContext: true,
      transferContext: "time-secondary",
      contextId: "time-secondary",
    }],
    bindings: evidenceMap.bindings,
    contextId: "time-primary",
  });
  assert.equal(answered[0].provenanceStatus, "PENDING_ASSESSMENT");
  const mapped = bindEvidenceToCompetencies({ events: answered, bindings: evidenceMap.bindings });
  assert.equal(highestSupportedProgression(mapped).code, "NOT_YET_EVIDENCED");
});


test("Time blueprint declares every competency used by its daily sequence", async () => {
  const blueprint = await json("content/curriculum/time/time-instructional-blueprint-v2.json");
  const declared = new Set(blueprint.competencyTargets.map(item => item.competencyId));
  const used = new Set(blueprint.days.flatMap(day => day.competencies ?? []));
  const missing = [...used].filter(id => !declared.has(id));
  assert.deepEqual(missing, []);
  assert.ok(declared.has("AC-C10"));
});


test("Time curriculum semantic graph remains internally consistent", async () => {
  const [blueprint, evidenceMap, atlas, framework, reports] = await Promise.all([
    json("content/curriculum/time/time-instructional-blueprint-v2.json"),
    json("content/curriculum/time/time-competency-evidence-map.json"),
    json("content/curriculum/applied-commerce/concept-atlas.json"),
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/report-classifications.json"),
  ]);

  const conceptIds = new Set(atlas.concepts.map(item => item.id));
  const competencyIds = new Set(framework.competencies.map(item => item.id));
  const declaredTargets = new Map(blueprint.competencyTargets.map(item => [item.competencyId, item]));
  const authoredAnchors = new Set(blueprint.days.flatMap(day => (day.evidence ?? []).map(item => item.anchor)));
  const reportIds = new Set(reports.classifications.map(item => item.id));
  const progressionRank = {
    NOT_YET_EVIDENCED: 0,
    NOTICE: 1,
    EXPLAIN: 2,
    APPLY: 3,
    TEST_AND_REVISE: 4,
    TRANSFER: 5,
  };

  for (const day of blueprint.days) {
    for (const conceptId of day.concepts ?? []) assert.ok(conceptIds.has(conceptId), `Unknown concept ${conceptId} on Day ${day.day}`);
    for (const competencyId of day.competencies ?? []) assert.ok(declaredTargets.has(competencyId), `Undeclared competency ${competencyId} on Day ${day.day}`);
    for (const reportId of day.reportingContribution ?? []) assert.ok(reportIds.has(reportId), `Unknown report classification ${reportId} on Day ${day.day}`);
  }

  for (const binding of evidenceMap.bindings ?? []) {
    assert.ok(authoredAnchors.has(binding.anchor), `Mapped anchor ${binding.anchor} is not authored in the Time blueprint`);
    assert.ok(competencyIds.has(binding.competencyId), `Unknown competency ${binding.competencyId} in Time evidence mapping`);
    const target = declaredTargets.get(binding.competencyId);
    assert.ok(target, `Mapped competency ${binding.competencyId} is missing from module targets`);
    assert.ok(
      progressionRank[binding.maxProgression] <= progressionRank[target.expectedCeiling],
      `${binding.anchor} exceeds the declared ceiling for ${binding.competencyId}`,
    );
  }
});


test("authored evidence ceilings constrain competency promotion", () => {
  const explainCappedAtNotice = highestSupportedProgression([
    {
      id: "limited-explanation",
      competencyId: "AC-C03",
      class: "INTERPRETATION",
      provenanceStatus: "VERIFIED",
      contextId: "time",
      maxProgression: "NOTICE",
    },
  ]);
  assert.equal(explainCappedAtNotice.code, "NOTICE");

  const transferCappedAtApply = highestSupportedProgression([
    {
      id: "foundation",
      competencyId: "AC-C15",
      class: "LEARNING_CHECK",
      provenanceStatus: "VERIFIED",
      contextId: "time-primary",
      maxProgression: "APPLY",
    },
    {
      id: "limited-transfer",
      competencyId: "AC-C15",
      class: "TRANSFER",
      provenanceStatus: "VERIFIED",
      contextId: "time-secondary",
      secondContext: true,
      maxProgression: "APPLY",
    },
  ]);
  assert.equal(transferCappedAtApply.code, "APPLY");
  assert.match(transferCappedAtApply.rationale, /authored evidence mapping limits/i);
});

test("legacy verified evidence without an authored ceiling keeps existing progression behaviour", () => {
  const result = highestSupportedProgression([
    {
      id: "legacy-interpretation",
      competencyId: "AC-C03",
      class: "INTERPRETATION",
      provenanceStatus: "VERIFIED",
      contextId: "legacy",
    },
  ]);
  assert.equal(result.code, "EXPLAIN");
});
