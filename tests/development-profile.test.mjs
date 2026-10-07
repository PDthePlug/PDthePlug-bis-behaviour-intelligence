import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildLearnerDevelopmentProfile,
  decorateCohortCompetencySummary,
} from "../lib/development-profile.mjs";

const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

test("My BIS turns authored evidence into a bounded development narrative without learner wording", async () => {
  const [framework, crosswalk, ancestry, timeMap] = await Promise.all([
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json"),
    json("content/curriculum/applied-commerce/lab-ancestry.json"),
    json("content/curriculum/time/time-competency-evidence-map.json"),
  ]);
  const make = (id, anchor, sensitivity = "P0") => ({
    id, lab_code: "TIM", lab_version: "1", enrolment_id: "time-enrolment",
    semantic_field_id: anchor, status: "ACTIVE", sensitivity,
    occurred_at: `2026-10-${String(Number(id.replace(/\D/g, "")) + 1).padStart(2, "0")}T10:00:00Z`,
    recorded_at: "2026-10-07T10:00:00Z",
    value: `PRIVATE WORDING ${id}`,
    classification_status: "STRUCTURAL",
    evidence_class: "UNCLASSIFIED",
  });
  const profile = buildLearnerDevelopmentProfile({
    learnerId: "L1",
    competencies: framework.competencies,
    externalCrosswalk: crosswalk,
    labAncestry: ancestry.labs,
    authoredBindings: timeMap.bindings,
    records: [
      make("e1", "TIM.D3.PREDICTION"),
      make("e2", "TIM.D6.REAL_WORLD_APPLICATION"),
      make("e3", "TIM.D7.BARRIER_DIAGNOSIS"),
      make("e4", "TIM.D7.JUSTIFIED_ADJUSTMENT"),
      make("e5", "TIM.D9.FINAL_REVIEW"),
      make("e6", "TIM.D10.TRANSFER_DEMONSTRATION"),
      make("e7", "TIM.D10.PROFILE_NARRATIVE", "P3"),
    ],
  });

  assert.equal(profile.title, "My BIS");
  assert.equal(profile.status, "AVAILABLE");
  const behaviour = profile.areas.find(area => area.competencyId === "AC-C04");
  assert.equal(behaviour.stageCode, "TEST_AND_REVISE");
  assert.match(behaviour.summary, /tested an approach/i);
  const transfer = profile.areas.find(area => area.competencyId === "AC-C15");
  assert.equal(transfer.stageCode, "TRANSFER");
  assert.ok(transfer.externalFrameworkAreas.includes("Metacognition"));
  assert.doesNotMatch(JSON.stringify(profile), /PRIVATE WORDING/);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "globalMaturityScore"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "personalityScore"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "diagnosis"), false);
  assert.match(profile.boundary, /not a personality label/i);
  assert.match(profile.boundary, /diagnosis/i);
});

test("My BIS uses approved curriculum mappings but refuses structural guesses", async () => {
  const [framework, crosswalk, ancestry] = await Promise.all([
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json"),
    json("content/curriculum/applied-commerce/lab-ancestry.json"),
  ]);
  const base = {
    lab_code: "HAB", lab_version: "4.5.2", enrolment_id: "hab-enrolment",
    status: "ACTIVE", sensitivity: "P1", evidence_class: "PLAN",
    competency: "Agency and initiative", occurred_at: "2026-10-07T10:00:00Z",
    recorded_at: "2026-10-07T10:00:00Z", value: "DO NOT CLASSIFY THIS TEXT",
  };
  const profile = buildLearnerDevelopmentProfile({
    learnerId: "L2",
    competencies: framework.competencies,
    externalCrosswalk: crosswalk,
    labAncestry: ancestry.labs,
    records: [
      { ...base, id: "structural", semantic_field_id: "HAB.TEST.STRUCTURAL", classification_status: "STRUCTURAL" },
      { ...base, id: "approved", semantic_field_id: "HAB.TEST.APPROVED", classification_status: "APPROVED" },
    ],
  });
  const agency = profile.areas.find(area => area.competencyId === "AC-C02");
  assert.equal(agency.stageCode, "APPLY");
  assert.equal(agency.evidenceCount, 1);
  assert.doesNotMatch(JSON.stringify(profile), /DO NOT CLASSIFY THIS TEXT/);
});

test("cohort competency decoration uses curriculum language without external certification", async () => {
  const [framework, crosswalk] = await Promise.all([
    json("content/curriculum/applied-commerce/competency-framework.json"),
    json("content/curriculum/external-frameworks/dbe-basic-education-competency-crosswalk.json"),
  ]);
  const summary = decorateCohortCompetencySummary({
    status: "AVAILABLE",
    participantCount: 8,
    minimumReportableCohortSize: 5,
    minimumReportableCellSize: 3,
    competencies: [{
      competency: "AC-C02",
      reportableParticipants: 6,
      distribution: [
        { code: "NOTICE", label: "Notices", count: 3 },
        { code: "APPLY", label: "Applies", count: 3 },
      ],
    }],
  }, { competencies: framework.competencies, externalCrosswalk: crosswalk });

  assert.equal(summary.status, "AVAILABLE");
  assert.equal(summary.competencies[0].title, "Agency and initiative");
  assert.ok(summary.competencies[0].externalFrameworkAreas.includes("Accountability"));
  assert.doesNotMatch(JSON.stringify(summary), /certified attainment|global maturity score/i);
});

test("cohort competency SQL stays aggregate-only and privacy gated", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261007130000_competency_intelligence_runtime.sql", import.meta.url), "utf8");
  assert.match(sql, /v_member_count < 5/);
  assert.match(sql, /classification_status = 'APPROVED'/);
  assert.match(sql, /e\.sensitivity in \('P0','P1','P2'\)/);
  assert.match(sql, /between 1 and 2/);
  assert.doesNotMatch(sql, /\be\.value\b/i);
  assert.doesNotMatch(sql, /display_name|learner_email/i);
});
