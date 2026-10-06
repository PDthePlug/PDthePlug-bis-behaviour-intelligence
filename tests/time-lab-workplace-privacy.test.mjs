import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Time Workplace learner evidence stays on the learner-owned workbook path", async () => {
  const learning = await source("app/api/learning/route.ts");

  assert.match(learning, /\.eq\("user_id", userId\)/);
  assert.match(learning, /\.eq\("lab_code", labCode\)/);
  assert.match(learning, /\.eq\("delivery_edition", profile\.deliveryEdition\)/);
  assert.match(learning, /\.eq\("provenance", "LR"\)/);
  assert.match(learning, /\.like\("semantic_field_id", `\$\{labCode\}\.WB\.%`\)/);
});

test("facilitator programme view cannot read or write individual Time workbook answers", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /workbookResponses: \{\}/);
  assert.match(player, /if \(facilitatorMode\) \{/);
  assert.match(player, /field\.disabled = true/);
  assert.match(player, /Learners write here/);
  assert.match(player, /if \(facilitatorMode\) return/);
  assert.match(player, /learner responses are private and are not shown or saved here/);
});

test("organisation reporting remains aggregate-only and suppresses small cohorts", async () => {
  const [staff, evidence] = await Promise.all([
    source("app/api/staff/route.ts"),
    source("lib/evidence-reporting.mjs"),
  ]);

  assert.match(staff, /aggregationOnly: true/);
  assert.match(staff, /minimumReportableCohortSize: 5/);
  assert.match(staff, /sponsorCannotSee: \["learner identity", "individual answer content", "reflection text", "experiment notes", "support request wording"\]/);
  assert.match(staff, /facilitatorCannotSee: \["learner answers", "hypothesis wording", "experiment notes", "Companion conversations", "memory items"\]/);
  assert.match(evidence, /participantCount < Math\.max\(5, flow\.minimumReportableCohortSize \?\? 5\)/);
  assert.match(evidence, /Small groups remain hidden for privacy/);
});

test("programme export contract excludes private learner narratives", async () => {
  const pdf = await source("lib/programme-report-pdf.ts");
  assert.match(pdf, /What remains private/);
  for (const privateField of ["targetPattern", "targetCondition", "alternativeBehaviour", "expectedReward", "hypothesis"]) {
    assert.doesNotMatch(pdf, new RegExp(privateField));
  }
});
