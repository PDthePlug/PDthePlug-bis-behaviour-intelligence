import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("final publishing check is persisted separately and restricted to Super Users", async () => {
  const [migration, schema, api] = await Promise.all([
    source("supabase/migrations/20260924221500_bis_content_preview_activation_uat.sql"),
    source("db/schema.ts"),
    source("app/api/content-studio/preview/route.ts"),
  ]);
  assert.match(migration, /create table public\.content_activation_uat/);
  assert.match(schema, /contentActivationUat/);
  assert.match(api, /requireRole\(roles, "SYSTEM_ADMIN"\)/);
});

test("sign-off remains bound to the exact prepared artifact fingerprint", async () => {
  const [contract, api] = await Promise.all([
    source("lib/content-uat.ts"),
    source("app/api/content-studio/route.ts"),
  ]);
  assert.match(contract, /artifactFingerprint/);
  assert.match(api, /uat\.artifactFingerprint !== fingerprint/);
  assert.match(api, /Finish the preview checklist and sign off this exact version before publishing/);
  assert.match(api, /resetUat\(versionId, identity\.id\)/);
});

test("learning review requires only the editions included in this version", async () => {
  const [contract, studio, api] = await Promise.all([
    source("lib/content-uat.ts"),
    source("app/content-studio/content-studio.tsx"),
    source("app/api/content-studio/route.ts"),
  ]);
  assert.match(contract, /availableArtifactKeys/);
  assert.match(studio, /filter\(\(slot\) => artifactKeys\.includes/);
  assert.match(studio, /Preview only the editions included in this version/);
  assert.match(api, /artifacts\.map\(\(artifact\) => artifact\.artifactKey\)/);
});

test("preview endpoint records the exact prepared content that was opened", async () => {
  const api = await source("app/api/content-studio/preview/route.ts");
  assert.match(api, /previewed\.add\(artifactKey\)/);
  assert.match(api, /CONTENT_RUNTIME_PREVIEWED/);
  assert.match(api, /artifactHash: artifact\.artifactHash/);
});

test("preview workspace supports desktop and mobile review", async () => {
  const workspace = await source("app/content-studio/preview/[versionId]/preview-workspace.tsx");
  assert.match(workspace, /Desktop/);
  assert.match(workspace, /Mobile/);
  assert.match(workspace, /<iframe/);
  assert.match(workspace, /Nothing here changes learner evidence or progress/);
});

test("preview mode never writes learner workbook or Lab evidence", async () => {
  const [player, lab] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
  ]);
  assert.match(player, /previewMode/);
  assert.match(player, /test responses stay in this browser only/);
  assert.match(lab, /previewMode && snapshot/);
  assert.match(lab, /test responses are not stored/);
});

test("publish control appears only after the final check has passed", async () => {
  const studio = await source("app/content-studio/content-studio.tsx");
  assert.match(studio, /entry\.status === "APPROVED" && finalCheckPassed/);
  assert.match(studio, /Preview and complete the final check first/);
  assert.match(studio, /action: "signOffUat"/);
  assert.match(studio, /action: "activateVersion"/);
});
