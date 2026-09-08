import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app/bis-app.tsx", import.meta.url), "utf8");
const operations = readFileSync(new URL("../app/operations-view.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const staffApi = readFileSync(new URL("../app/api/staff/route.ts", import.meta.url), "utf8");

test("learner shell uses the approved navigation language", () => {
  for (const label of ["Home", "My Lab", "Today", "Review", "Companion", "Privacy", "Progress"]) {
    assert.match(app, new RegExp(`label: \\"${label}\\"`));
  }
  assert.match(app, /mobileNav = nav\.slice\(0, 5\)/);
});

test("adaptive shell exposes role-scoped system views", () => {
  assert.match(app, /> Learner View</);
  assert.match(app, /> Facilitator View</);
  assert.match(app, /> Audit View</);
  assert.match(app, /staffRoles\.includes\("SYSTEM_ADMIN"\)/);
  assert.match(operations, /perspective === "audit" && !canAudit/);
  assert.match(operations, /perspective === "facilitator" && !canFacilitate/);
});

test("screen orientation answers the five experience questions", () => {
  for (const label of ["Where you are", "What this means", "Do now", "Next", "Get help"]) {
    assert.ok(app.includes(label), `${label} should be present in the adaptive context bar`);
  }
  assert.match(app, /onHelp=.*setView\("companion"\)/);
});

test("facilitator and audit information architecture uses canonical names", () => {
  for (const label of ["Cohort dashboard", "Learner summaries", "Support flags", "Readiness review", "Evidence registry", "Calculation trace", "Formula versions", "Provenance map", "Privacy classification"]) {
    assert.ok(operations.includes(label), `${label} should be present`);
  }
  assert.match(operations, /Private learner wording is never part of cohort telemetry/);
});

test("mobile shell is task-focused and page overflow remains contained", () => {
  assert.match(css, /\.mobile-task-dock/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /body \{[^}]*overflow-x: hidden/);
  assert.match(css, /\.corelab-shell \{[^}]*overflow-x: clip/);
});

test("staff API remains outside private learner response stores", () => {
  assert.doesNotMatch(staffApi, /responseRecords|companionTurns|memoryEntries|hypotheses/);
  assert.match(operations, /Learner answers, hypothesis wording, experiment notes, Companion conversations and memory are never returned/);
});
