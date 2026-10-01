import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateUniversalComputed,
  universalComputedLeafInputs,
} from "../lib/universal-lab-v2.mjs";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Universal V2 calculation provenance resolves back to learner evidence leaves", () => {
  const definition = {
    computedFields: [
      { id: "RSK.I4.SCORE", operation: "PRODUCT", inputs: ["RSK.I4.P", "RSK.I4.M"], precision: 0 },
      { id: "RSK.I9.PROFILE_SCORE", operation: "COPY", inputs: ["RSK.I4.SCORE"] },
    ],
  };
  assert.deepEqual(
    universalComputedLeafInputs(definition, "RSK.I9.PROFILE_SCORE").sort(),
    ["RSK.I4.M", "RSK.I4.P"],
  );
  assert.deepEqual(
    evaluateUniversalComputed(definition, { "RSK.I4.P": 4, "RSK.I4.M": 5 }),
    { "RSK.I4.SCORE": 20, "RSK.I9.PROFILE_SCORE": 20 },
  );
});

test("Universal Lab responses enter the shared evidence registry", async () => {
  const route = await source("app/api/universal-lab/route.ts");
  assert.match(route, /evidenceRecords/);
  assert.match(route, /sourceObjectType: "RESPONSE"/);
  assert.match(route, /provenance: "SR"/);
  assert.match(route, /status: responseStatus === "PASS" \? "WITHDRAWN" : "ACTIVE"/);
  assert.match(route, /status: "SUPERSEDED"/);
});

test("Universal V2 derived values persist as enrolment-scoped measurements with source provenance", async () => {
  const [route, schema, migration] = await Promise.all([
    source("app/api/universal-lab/route.ts"),
    source("db/schema.ts"),
    source("supabase/migrations/20261001103000_universal_lab_measurement_scope.sql"),
  ]);

  assert.match(route, /syncUniversalComputedMeasurements/);
  assert.match(route, /measurementValues/);
  assert.match(route, /measurementSources/);
  assert.match(route, /universalComputedLeafInputs/);
  assert.match(route, /formulaVersion: "universal-lab-v2"/);
  assert.match(route, /sourceObjectType: "RESPONSE"/);
  assert.match(schema, /enrolmentId: text\("enrolment_id"\)/);
  assert.match(schema, /uq_measurement_user_enrolment_code/);
  assert.match(migration, /add column if not exists enrolment_id text/);
  assert.match(migration, /where enrolment_id is not null/);
});
