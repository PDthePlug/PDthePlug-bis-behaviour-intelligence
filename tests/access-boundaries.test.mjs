import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("staff operations never import or select private learner reflection stores", async () => {
  const route = await readFile(new URL("app/api/staff/route.ts", root), "utf8");

  for (const privateStore of ["responses", "hypotheses", "companionTurns", "memoryItems"]) {
    assert.doesNotMatch(route, new RegExp(`\\b${privateStore}\\b`));
  }
  assert.doesNotMatch(route, /experimentEvents\.notes/);
  assert.match(route, /facilitatorCannotSee:[\s\S]*"learner answers"[\s\S]*"experiment notes"[\s\S]*"Companion conversations"/);
});

test("every restricted mutation has a server-side role gate", async () => {
  const route = await readFile(new URL("app/api/staff/route.ts", root), "utf8");
  const gates = {
    assignRole: "SYSTEM_ADMIN",
    revokeRole: "SYSTEM_ADMIN",
    createCohort: "SYSTEM_ADMIN",
    addCohortMember: "SYSTEM_ADMIN",
    assignLabVersion: "SYSTEM_ADMIN",
    addFacilitatorNote: "FACILITATOR",
    openSafeguardingCase: "FACILITATOR",
    acknowledgeSafeguardingCase: "SAFEGUARDING_OFFICER",
    resolveSafeguardingCase: "SAFEGUARDING_OFFICER",
  };

  for (const [action, role] of Object.entries(gates)) {
    assert.match(
      route,
      new RegExp(`action === "${action}"\\) \\{\\s+requireRole\\(roles, "${role}"\\)`),
      `${action} must require ${role}`,
    );
  }
  assert.match(route, /The final system administrator cannot be revoked/);
  assert.match(route, /safeguarding: hasRole\(roles, "SAFEGUARDING_OFFICER"\)/);
});

test("learner support is a human-only, auditable restricted handoff", async () => {
  const [learnerRoute, experience, schema] = await Promise.all([
    readFile(new URL("app/api/bis/route.ts", root), "utf8"),
    readFile(new URL("app/bis-app.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
  ]);

  assert.match(learnerRoute, /action === "requestSupport"/);
  assert.match(learnerRoute, /HUMAN_SUPPORT_REQUESTED/);
  assert.match(learnerRoute, /sourceType: "LEARNER_REQUEST"/);
  assert.match(experience, /BIS does not diagnose you or assign an automated risk score/);
  assert.match(experience, /BIS is not an emergency service/);
  for (const table of ["roleAssignments", "pilotCohorts", "cohortMembers", "facilitatorNotes", "safeguardingCases", "labAssignments"]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
});

test("release migration is append-only", async () => {
  const migration = await readFile(new URL("drizzle/0002_nebulous_luke_cage.sql", root), "utf8");
  assert.match(migration, /CREATE TABLE `role_assignments`/);
  assert.match(migration, /CREATE TABLE `safeguarding_cases`/);
  assert.doesNotMatch(migration, /\b(?:DROP|ALTER)\s+(?:TABLE|COLUMN|INDEX)\b/i);
});
