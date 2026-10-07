import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { productionSession } from "./hardening-production-session.mjs";

const group = JSON.parse(await readFile("/tmp/bis-production-takeover-group.json", "utf8"));
assert.ok(group.name.startsWith("BIS verification only 20261007"));
const rows = [];
for (const role of ["LEARNER", "FACILITATOR", "SPONSOR_VIEWER", "PROGRAMME_OWNER", "SYSTEM_ADMIN", "SAFEGUARDING_OFFICER"]) {
  const session = await productionSession(role);
  const identity = await session.request("/api/bis?scope=profile");
  assert.ok(identity);
  rows.push({ role, route: "/api/bis?scope=profile", status: 200 });
  if (role === "LEARNER") {
    for (const route of ["/api/staff", "/api/content-studio"]) {
      const response = await session.response(route);
      assert.equal(response.status, 403);
      rows.push({ role, route, status: response.status, expectedDenial: true });
    }
  } else {
    const snapshot = await session.request("/api/staff");
    if (["SPONSOR_VIEWER", "PROGRAMME_OWNER"].includes(role)) {
      assert.equal(snapshot.sponsor.cohorts.length, 1);
      assert.equal(snapshot.sponsor.cohorts[0].cohort.id, group.id);
      assert.equal(snapshot.sponsor.cohorts[0].decisionRegister.canManage, role === "PROGRAMME_OWNER");
    }
    if (role === "FACILITATOR") {
      assert.ok(snapshot.facilitator);
      const cohorts = snapshot.facilitator.cohorts;
      assert.equal(cohorts.length, 1);
      assert.equal(cohorts[0].id, group.id);
    }
    rows.push({ role, route: "/api/staff", status: 200, isolatedCohortScope: ["SPONSOR_VIEWER", "PROGRAMME_OWNER", "FACILITATOR"].includes(role) ? "PASS" : "GLOBAL_ROLE; original records not captured" });
    if (role !== "SYSTEM_ADMIN") {
      const response = await session.response("/api/content-studio");
      assert.equal(response.status, 403);
      rows.push({ role, route: "/api/content-studio", status: 403, expectedDenial: true });
    }
  }
}
await writeFile("docs/hardening/production-takeover-role-baseline.json", JSON.stringify({ observedAt: new Date().toISOString(), groupId: group.id, rows }, null, 2) + "\n");
console.log({ roles: 6, checks: rows.length, result: "PASS", originalRecordContentCaptured: false });
