import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidencePortfolio } from "../lib/evidence-portfolio.mjs";
import { evidenceCompanion } from "../lib/evidence-companion.mjs";
import { programmeEvidenceGuidance, structuralSupport } from "../lib/evidence-reporting.mjs";
import { computeHabitMetrics } from "../lib/bis-metrics.mjs";

const enrolment = { id: "en", labCode: "HAB", labVersion: "4.5.2", status: "IN_PROGRESS", currentInvestigation: 3 };
const record = (id, investigationId, status = "ACTIVE", labVersion = "4.5.2") => ({ id: `anchor-${id}`, labCode: "HAB", labVersion, investigationId, sourceObjectType: "RESPONSE", sourceObjectId: id, status, value: "PRIVATE WORDING" });

test("actual I0 starting evidence supports a bounded summary without private wording or improvement claims", () => {
  const [lab] = buildEvidencePortfolio({ enrolments: [enrolment], evidence: [record("r0", "HAB.I0"), record("r1", "HAB.I1")] });
  assert.equal(lab.anchors[0].evidenceCount, 1);
  assert.equal(lab.intelligence.nextAction.investigation, 3);
  assert.match(lab.intelligence.summary, /no recorded real-world test observations/);
  assert.equal(lab.intelligence.classificationStatus, "UNCLASSIFIED");
  assert.equal(lab.intelligence.confidence, null);
  assert.equal(JSON.stringify(lab).includes("PRIVATE WORDING"), false);
});

test("withdrawn, orphan and other-version sources cannot verify a downstream measure", () => {
  const [lab] = buildEvidencePortfolio({ enrolments: [enrolment], evidence: [record("old", "HAB.I0", "ACTIVE", "old"), record("passed", "HAB.I0", "WITHDRAWN"), record("current", "HAB.I1")], measurements: [{ id: "m", enrolmentId: "en", code: "HAB.BEI06", value: 100 }], measurementSources: [{ measurementId: "m", sourceObjectId: "passed" }] });
  assert.equal(lab.metrics[0].provenanceStatus, "UNVERIFIED");
  assert.deepEqual(lab.intelligence.evidenceRefs.map(ref => ref.sourceObjectId), ["current"]);
});

test("Companion retrieves only current answered anchored evidence and cites immutable response IDs", () => {
  const [lab] = buildEvidencePortfolio({ enrolments: [enrolment], evidence: [record("r1", "HAB.I2")] });
  const context = { intelligence: lab.intelligence, responses: { "HAB.EVIDENCE.INITIAL": { responseId: "r1", status: "ANSWERED", value: "My original record" } } };
  assert.deepEqual(evidenceCompanion("show evidence", context).evidenceRefs, ["r1"]);
  assert.match(evidenceCompanion("show evidence", context).reply, /My original record/);
  context.responses["HAB.EVIDENCE.INITIAL"].status = "PASS";
  assert.deepEqual(evidenceCompanion("show evidence", context).evidenceRefs, []);
  context.responses["HAB.EVIDENCE.INITIAL"].status = "ANSWERED";
  context.responses["HAB.EVIDENCE.INITIAL"].responseId = "orphan";
  assert.deepEqual(evidenceCompanion("show evidence", context).evidenceRefs, []);
  assert.match(evidenceCompanion("summarise my portfolio", context).reply, /conclusion remains open/);
});

test("an observation suggests review without claiming calendar readiness or profile completion", () => {
  const [lab] = buildEvidencePortfolio({ enrolments: [{ ...enrolment, experimentStartedAt: "2026-10-04" }], evidence: [record("r0", "HAB.I0"), record("day", "HAB.I7")] });
  assert.match(lab.intelligence.nextAction.label, /when available/);
  assert.match(lab.intelligence.nextAction.reason, /within the experiment window/);
  assert.equal(lab.status, "IN_PROGRESS");
});

test("report guidance independently suppresses small groups and distinguishes preparation and no opportunity", () => {
  const outcome = { suppressed: false, participantCount: 20, minimumReportableCohortSize: 5, metrics: { experiment: { observationsRecorded: 0, eligibleOpportunities: 0 }, evidence: { sufficient: 0 } } };
  assert.match(programmeEvidenceGuidance(outcome).summary, /do not establish behaviour change/);
  assert.equal(programmeEvidenceGuidance({ ...outcome, participantCount: 4 }), null);
  assert.equal(programmeEvidenceGuidance({ ...outcome, suppressed: true }), null);
  outcome.metrics.experiment.observationsRecorded = 3;
  assert.match(programmeEvidenceGuidance(outcome).summary, /neither failure nor proof of improvement/);
  assert.match(structuralSupport(enrolment, null), /Progress alone does not establish readiness/);
});

test("unknown alternative outcomes remain missing rather than failed attempts", () => {
  const metrics = computeHabitMetrics([{ eligibleOpportunity: true, alternativeUsed: null }], 80);
  assert.equal(metrics.opportunityCount, 1);
  assert.equal(metrics.adherence, null);
  assert.equal(metrics.predictionAccuracy, null);
  assert.equal(metrics.evidenceStrength, "LIMITED");
});

test("missing predictions do not create prediction accuracy", () => {
  const metrics = computeHabitMetrics([{ eligibleOpportunity: true, alternativeUsed: true }], null);
  assert.equal(metrics.adherence, 100);
  assert.equal(metrics.predictionAccuracy, null);
});
