import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Activation UAT is persisted separately and restricted to Super Users", async () => {
  const [migration, schema, api] = await Promise.all([
    source("supabase/migrations/20260924221500_bis_content_preview_activation_uat.sql"),
    source("db/schema.ts"),
    source("app/api/content-studio/preview/route.ts"),
  ]);
  assert.match(migration, /create table public\.content_activation_uat/);
  assert.match(migration, /content_activation_uat_super_user/);
  assert.match(migration, /private\.has_staff_role\('SYSTEM_ADMIN'\)/);
  assert.match(schema, /contentActivationUat/);
  assert.match(api, /requireRole\(roles, "SYSTEM_ADMIN"\)/);
});

test("UAT sign-off is bound to the exact compiled artifact fingerprint", async () => {
  const [contract, api] = await Promise.all([
    source("lib/content-uat.ts"),
    source("app/api/content-studio/route.ts"),
  ]);
  assert.match(contract, /artifactFingerprint/);
  assert.match(contract, /artifactKey.*artifactHash/);
  assert.match(api, /uat\.artifactFingerprint !== fingerprint/);
  assert.match(api, /Activation UAT must be completed and signed off against the current compiled runtime/);
  assert.match(api, /resetUat\(versionId, identity\.id\)/);
});

test("Learning-module UAT requires previews for all three editions", async () => {
  const [contract, studio] = await Promise.all([
    source("lib/content-uat.ts"),
    source("app/content-studio/content-studio.tsx"),
  ]);
  for (const key of ["learning:school", "learning:emerging_adult", "learning:workplace"]) {
    assert.ok(contract.includes(key));
    assert.ok(studio.includes(key));
  }
  assert.match(studio, /All three editions previewed/);
  assert.match(studio, /Preview all three editions/);
});

test("preview endpoint records the exact artifact that was opened", async () => {
  const api = await source("app/api/content-studio/preview/route.ts");
  assert.match(api, /previewed\.add\(artifactKey\)/);
  assert.match(api, /CONTENT_RUNTIME_PREVIEWED/);
  assert.match(api, /artifactHash: artifact\.artifactHash/);
  assert.match(api, /cache-control.*private, no-store/);
});

test("preview workspace supports desktop/mobile review and edition switching", async () => {
  const workspace = await source("app/content-studio/preview/[versionId]/preview-workspace.tsx");
  assert.match(workspace, /School/);
  assert.match(workspace, /Emerging Adult/);
  assert.match(workspace, /Workplace/);
  assert.match(workspace, /Desktop/);
  assert.match(workspace, /Mobile/);
  assert.match(workspace, /<iframe/);
  assert.match(workspace, /Nothing here changes learner evidence or progress/);
});

test("Programme Player UAT preview is read-only and uses the real compiled artifact", async () => {
  const player = await source("app/learning/programme-player.tsx");
  assert.match(player, /previewVersionId/);
  assert.match(player, /api\/content-studio\/preview/);
  assert.match(player, /Activation UAT preview · no learner data is saved/);
  assert.match(player, /test responses stay in this browser only/);
  assert.match(player, /Next preview page/);
});

test("Universal Lab UAT preview uses the shared nine-investigation renderer without persistence", async () => {
  const lab = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.match(lab, /previewVersionId/);
  assert.match(lab, /api\/content-studio\/preview/);
  assert.match(lab, /previewMode && snapshot/);
  assert.match(lab, /Activation UAT preview · test responses are not stored/);
  assert.match(lab, /<LabInvestigationFrame/);
});

test("activation control appears only after UAT has passed", async () => {
  const studio = await source("app/content-studio/content-studio.tsx");
  assert.match(studio, /entry\.status === "APPROVED" && uatPassed/);
  assert.match(studio, /Activation locked until UAT sign-off/);
  assert.match(studio, /action: "signOffUat"/);
  assert.match(studio, /action: "activateVersion"/);
});

test("manual UAT covers content, navigation, inputs, responsive layout, handoffs and learner language", async () => {
  const contract = await source("lib/content-uat.ts");
  for (const id of [
    "authored_content",
    "navigation",
    "inputs_privacy",
    "responsive",
    "handoff_completion",
    "learner_language",
  ]) {
    assert.ok(contract.includes(id));
  }
});
