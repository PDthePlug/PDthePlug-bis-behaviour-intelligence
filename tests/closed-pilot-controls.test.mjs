import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("keeps experiment calibration and completion choices explicit", async () => {
  const [route, experience] = await Promise.all([
    readFile(new URL("app/api/bis/route.ts", root), "utf8"),
    readFile(new URL("app/bis-app.tsx", root), "utf8"),
  ]);

  assert.match(route, /action === "saveCheckpoint"/);
  assert.match(route, /DAY_3_CHECKPOINT/);
  assert.match(route, /FINISH_INSUFFICIENT/);
  assert.match(route, /INSUFFICIENT_EVIDENCE_CUE_ADJUSTMENT/);
  assert.match(experience, /Calibrate without erasing version 1/);
  assert.match(experience, /Finish with insufficient evidence/);
  assert.match(experience, /excluded from adherence rather than scored as 0%/);
});

test("ships traceability, reminder and consent controls together", async () => {
  const [schema, route, experience] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/bis/route.ts", root), "utf8"),
    readFile(new URL("app/bis-app.tsx", root), "utf8"),
  ]);

  for (const table of [
    "experimentParameterVersions",
    "experimentCheckpoints",
    "measurementSources",
    "notificationPreferences",
    "pilotEvents",
  ]) {
    assert.match(schema, new RegExp(`export const ${table}`));
  }
  assert.match(route, /action === "withdrawConsent"/);
  assert.match(route, /action === "restoreConsent"/);
  assert.match(experience, /Measure → evidence → source/);
  assert.match(experience, /This pilot does not send push notifications, email or SMS/);
}
);
