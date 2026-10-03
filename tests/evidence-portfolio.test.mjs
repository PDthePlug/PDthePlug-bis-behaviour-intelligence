import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidencePortfolio, humanMetricLabel } from "../lib/evidence-portfolio.mjs";

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
