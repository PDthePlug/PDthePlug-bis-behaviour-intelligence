import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app/bis-app.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("../app/operations-view.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/workspace/staff-workspace-shell.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const staffApi = readFileSync(new URL("../app/api/staff/route.ts", import.meta.url), "utf8");

test("learner shell uses the approved navigation language", () => {
  for (const label of ["Home", "My Lab", "Today", "Review", "Companion", "Privacy", "Progress"]) {
    assert.match(app, new RegExp(`label: \\"${label}\\"`));
  }
  assert.match(app, /mobileNav = nav\.slice\(0, 5\)/);
});

test("programme workspace exposes the three role-specific surfaces", () => {
  for (const label of ["Facilitator", "Programme Outcomes", "BIS Administrator"]) {
    assert.match(workspace, new RegExp(label));
  }
  assert.match(workspace, /roles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(workspace, /roles\.includes\("SPONSOR_VIEWER"\)/);
  assert.match(operations, /perspective === "admin" && !canAdminister/);
  assert.match(operations, /perspective === "outcomes" && !canViewOutcomes/);
  assert.match(operations, /perspective === "facilitator" && !canFacilitate/);
  assert.doesNotMatch(workspace, /Audit View/);
});

test("staff workspace is task-first and omits orientation explainer panels", () => {
  for (const label of ["Where you are", "What this means", "Do now", "What happens next", "Least-privilege access"]) {
    assert.doesNotMatch(operations, new RegExp(label));
  }
  assert.doesNotMatch(operations, /OperationsOrientation/);
});

test("facilitator and administrator information architecture uses human labels", () => {
  for (const label of ["Cohort", "Participants", "Support", "Review", "Access", "Programmes", "Activity", "Advanced system checks"]) {
    assert.ok(operations.includes(label), `${label} should be present`);
  }
  for (const oldLabel of ["Evidence registry", "Calculation trace", "Formula versions", "Provenance map", "Privacy classification"]) {
    assert.doesNotMatch(operations, new RegExp(oldLabel));
  }
});

test("mobile shell is task-focused and page overflow remains contained", () => {
  assert.match(css, /\.mobile-task-dock/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /body \{[^}]*overflow-x: hidden/);
  assert.match(css, /\.corelab-shell \{[^}]*overflow-x: clip/);
});

test("staff API remains outside private learner response stores", () => {
  assert.doesNotMatch(staffApi, /responseRecords|companionTurns|memoryEntries|hypotheses/);
  assert.match(staffApi, /facilitatorCannotSee:[\s\S]*"learner answers"[\s\S]*"experiment notes"/);
  assert.match(staffApi, /sponsorCannotSee:[\s\S]*"learner identity"[\s\S]*"reflection text"/);
});
