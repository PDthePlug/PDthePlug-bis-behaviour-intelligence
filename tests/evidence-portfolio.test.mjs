import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidencePortfolio, humanMetricLabel, explainPortfolioMeasures } from "../lib/evidence-portfolio.mjs";

test("evidence portfolio turns the Lab trail into stable learner-facing anchors", () => {
  const labs = buildEvidencePortfolio({
    enrolments: [{
      id: "enrol-1",
      labCode: "HAB",
      labVersion: "4.5.2",
      status: "COMPLETED",
      currentInvestigation: 9,
      startedAt: "2026-10-01T08:00:00Z",
      phaseACompletedAt: "2026-10-01T09:30:00Z",
      experimentStartedAt: "2026-10-01T09:30:00Z",
      completedAt: "2026-10-08T12:00:00Z",
    }],
    evidence: [
      { labCode: "HAB", labVersion: "4.5.2", investigationId: "HAB.BASELINE", status: "ACTIVE", recordedAt: "2026-10-01T08:05:00Z" },
      { labCode: "HAB", labVersion: "4.5.2", investigationId: "HAB.I4", status: "ACTIVE", recordedAt: "2026-10-01T08:30:00Z" },
      { labCode: "HAB", labVersion: "4.5.2", investigationId: "HAB.I7", status: "ACTIVE", recordedAt: "2026-10-02T18:00:00Z" },
      { labCode: "HAB", labVersion: "4.5.2", investigationId: "HAB.I8", status: "ACTIVE", recordedAt: "2026-10-08T10:00:00Z" },
      { labCode: "HAB", labVersion: "4.5.2", investigationId: "HAB.I9", status: "ACTIVE", recordedAt: "2026-10-08T11:00:00Z" },
    ],
    measurements: [{
      id: "m1",
      enrolmentId: null,
      labCode: null,
      labVersion: null,
      code: "HAB.BEI06",
      value: "60",
      status: "VALUE",
      evidenceStrength: "SUFFICIENT_FOR_LAB",
      formulaVersion: "1.0",
      calculatedAt: "2026-10-08T10:30:00Z",
    }],
    measurementSources: [
      { measurementId: "m1", sourceObjectId: "r1" },
      { measurementId: "m1", sourceObjectId: "r2" },
    ],
    labTitles: { HAB: "Habit Lab" },
  });

  assert.equal(labs.length, 1);
  assert.equal(labs[0].title, "Habit Lab");
  assert.equal(labs[0].summary.recordedAnchors, 5);
  assert.equal(labs[0].metrics[0].label, "Observed adherence");
  assert.equal(labs[0].metrics.length, 1);
  assert.equal(labs[0].metrics[0].value, "60%");
  assert.equal(labs[0].metrics[0].sourceCount, 2);
  assert.equal(labs[0].anchors.find((anchor) => anchor.id === "EXPERIMENT")?.status, "RECORDED");
});

test("portfolio never needs original private response wording to explain provenance", () => {
  const labs = buildEvidencePortfolio({
    enrolments: [{ id: "e", labCode: "DEC", labVersion: "4.2.1", status: "IN_PROGRESS", currentInvestigation: 7 }],
    evidence: [{ labCode: "DEC", labVersion: "4.2.1", investigationId: "DEC.I7", status: "ACTIVE", value: "\"private answer\"" }],
  });

  assert.equal(labs[0].summary.activeEvidenceItems, 1);
  assert.equal(JSON.stringify(labs).includes("private answer"), false);
});

test("known measurement codes are translated into human meaning", () => {
  assert.equal(humanMetricLabel("HAB.BEI03"), "Prediction accuracy");
  assert.equal(humanMetricLabel("HAB.BEI06"), "Observed adherence");
  assert.equal(humanMetricLabel("HAB.CONTROL_SHIFT"), "Control shift");
});


test("portfolio keeps only the latest applicable value for a repeated metric code", () => {
  const labs = buildEvidencePortfolio({
    enrolments: [{
      id: "enrol-current",
      labCode: "HAB",
      labVersion: "4.5.2",
      status: "IN_PROGRESS",
      currentInvestigation: 8,
      updatedAt: "2026-10-08T12:00:00Z",
    }],
    measurements: [
      {
        id: "new",
        enrolmentId: null,
        labCode: null,
        code: "HAB.BEI06",
        value: "75",
        status: "VALUE",
        evidenceStrength: "SUFFICIENT_FOR_LAB",
        formulaVersion: "1.0",
        calculatedAt: "2026-10-08T12:00:00Z",
      },
      {
        id: "old",
        enrolmentId: null,
        labCode: null,
        code: "HAB.BEI06",
        value: "40",
        status: "VALUE",
        evidenceStrength: "LIMITED",
        formulaVersion: "1.0",
        calculatedAt: "2026-09-01T12:00:00Z",
      },
    ],
  });

  assert.equal(labs[0].metrics.length, 1);
  assert.equal(labs[0].metrics[0].value, "75%");
});

test("Universal measures use the enrolled source label and do not turn counts into percentages", () => {
  const result=buildEvidencePortfolio({
    enrolments:[{id:"risk-enrolment",labCode:"RSK",labVersion:"1.0"}],
    measurements:[{id:"risk-days",enrolmentId:"risk-enrolment",code:"RSK.BEI06",value:"4",status:"VALUE",formulaVersion:"universal-lab-v2:bei"}],
    metricLabels:{"risk-enrolment:RSK.BEI06":"Observation days completed"},
  });
  assert.equal(result[0].metrics[0].label,"Observation days completed");
  assert.equal(result[0].metrics[0].value,"4");
});

test("feedback explains follow-through, self-report and prediction without scoring competence", () => {
  const metric = (code, value) => ({ code: `HAB.${code}`, value, provenanceStatus: "VERIFIED", formulaVersion: "1.0" });
  const feedback = explainPortfolioMeasures([metric("BEI06", "67%"), metric("OPPORTUNITY_COUNT", "6"), metric("REPLACEMENT_COUNT", "4"), metric("CONTROL_SHIFT", "+2"), metric("BEI03", "97%")]);
  assert.match(feedback[0].meaning, /4 of 6 recorded opportunities/);
  assert.match(feedback[0].nextStep, /one occasion.*one when you did not/);
  assert.match(feedback[1].meaning, /2 points higher/);
  assert.match(feedback[1].meaning, /not a measured gain in skill/);
  assert.match(feedback[2].meaning, /3 percentage points/);
});

test("feedback refuses Universal code reuse, unverified sources and conflicting counts", () => {
  const metric = { code: "HAB.BEI06", value: "67%", provenanceStatus: "VERIFIED", formulaVersion: "1.0" };
  assert.deepEqual(explainPortfolioMeasures([{ ...metric, formulaVersion: "universal-lab-v2:bei" }]), []);
  assert.deepEqual(explainPortfolioMeasures([{ ...metric, provenanceStatus: "UNVERIFIED" }]), []);
  assert.deepEqual(explainPortfolioMeasures([{ ...metric, code: "RSK.BEI06" }]), []);
  assert.deepEqual(explainPortfolioMeasures([{ ...metric, value: "Not available" }]), []);
  const feedback = explainPortfolioMeasures([metric, { ...metric, code: "HAB.OPPORTUNITY_COUNT", value: "10" }, { ...metric, code: "HAB.REPLACEMENT_COUNT", value: "2" }]);
  assert.doesNotMatch(feedback[0].meaning, /2 of 10/);
  assert.equal(feedback[0].codes.length, 1);
});
