import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("learner profile does not advertise staff access unless a staff role exists", async () => {
  const profile = await source("app/profile/profile-dashboard.tsx");
  assert.match(profile, /const staff = hasStaffRole\(roles\)/);
  assert.match(profile, /\{staff \? \(/);
  assert.match(profile, /Open programme workspace/);
  assert.match(profile, /"SPONSOR_VIEWER"/);
  assert.match(profile, /"PROGRAMME_OWNER"/);
  assert.doesNotMatch(profile, /Facilitator and Audit access is assigned/);
  assert.doesNotMatch(profile, /cannot be self-registered from a learner account/);
});

test("root role routing treats organisation reporting as staff access", async () => {
  const router = await source("app/role-router.tsx");
  assert.match(router, /"SPONSOR_VIEWER"/);
  assert.match(router, /"PROGRAMME_OWNER"/);
  assert.match(router, /router\.replace\(staff \? "\/workspace" : "\/habit"\)/);
});

test("staff workspace defaults directly to a permitted perspective", async () => {
  const shell = await source("app/workspace/staff-workspace-shell.tsx");
  assert.match(shell, /if \(canFacilitate\(roles\)\) return "facilitator"/);
  assert.match(shell, /if \(roles\.includes\("SPONSOR_VIEWER"\) \|\| roles\.includes\("PROGRAMME_OWNER"\)\) return "outcomes"/);
  assert.match(shell, /return "admin"/);
  assert.match(shell, /defaultPerspective\(session\.roles\)/);
  assert.match(shell, /requestedPerspective/);
  assert.match(shell, /params\.set\("view", next\)/);
});

test("programme PDF export requires organisation reporting or system administration", async () => {
  const route = await source("app/api/staff/route.ts");
  assert.match(route, /url\.searchParams\.get\("report"\) === "pdf"/);
  assert.match(route, /!hasRole\(roles, "SPONSOR_VIEWER"\) && !hasRole\(roles, "PROGRAMME_OWNER"\) && !hasRole\(roles, "SYSTEM_ADMIN"\)/);
  assert.match(route, /sponsorSnapshot\(identity, roles\)/);
  assert.match(route, /snapshot\.cohorts\.find\(\(item\) => item\.cohort\?\.id === cohortId\)/);
  assert.match(route, /PROGRAMME_REPORT_EXPORTED/);
  assert.match(route, /"content-type": "application\/pdf"/);
  assert.match(route, /"cache-control": "private, no-store"/);
});

test("programme PDF renderer is a structured institutional report and excludes private learner fields", async () => {
  const pdf = await source("lib/programme-report-pdf.ts");
  assert.match(pdf, /%PDF-1\.4/);
  assert.match(pdf, /Executive summary/);
  assert.match(pdf, /KEY FINDINGS/);
  assert.match(pdf, /Learning journey/);
  assert.match(pdf, /Behaviour in practice/);
  assert.match(pdf, /EXPECTATION VS OBSERVED BEHAVIOUR/);
  assert.match(pdf, /How much information we have/);
  assert.match(pdf, /Human support/);
  assert.match(pdf, /Experiment landscape/);
  assert.match(pdf, /Action plan/);
  assert.match(pdf, /What remains private/);
  for (const privateField of ["targetPattern", "targetCondition", "alternativeBehaviour", "expectedReward", "hypothesis"]) {
    assert.doesNotMatch(pdf, new RegExp(privateField));
  }
});

test("programme outcomes expose a factual summary and PDF action", async () => {
  const view = await source("app/programme-outcomes-view.tsx");
  assert.match(view, /What stands out/);
  assert.match(view, /What the group evidence is telling us/);
  assert.match(view, /Group averages can hide what happened for individuals/);
  assert.match(view, /Download PDF/);
  assert.match(view, /report=pdf&cohortId=/);
});
