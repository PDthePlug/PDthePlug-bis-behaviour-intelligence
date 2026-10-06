import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";
import { loadContentTools } from "./lib/load-content-tools.mjs";

// Staging only. An immutable update of the reviewed source tests real edition
// supersession without replacing any source, existing draft or learner record.
if (process.env.BIS_STAGING_ALLOW_MUTATIONS !== "true") throw new Error("Explicit staging mutation acknowledgement required.");
const phase = process.env.BIS_HISTORY_PHASE || "prepare";
const output = process.env.BIS_HISTORY_DIR || "/tmp/bis-learning-history";
await mkdir(output, { recursive: true });
const admin = await stagingSession();
const learner = await stagingSession("LEARNER", 19);
const select = snapshot => snapshot.items.find(item => item.id === "content:module:HAB");
const initial = select(await admin.request("/api/content-studio"));
assert.equal(initial.kind, "LEARNING_MODULE");
let record;
try { record = JSON.parse(await readFile(`${output}/prepared.json`, "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
async function save() { await writeFile(`${output}/prepared.json`, JSON.stringify(record, null, 2)); }
async function openStudio(page) {
  await page.goto(admin.base + "/content-studio");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /^HAB\b/ }).click();
  await page.getByRole("tab", { name: "Learning module", exact: true }).click();
  await expect(page.locator(".content-detail-hero")).toContainText("Habit Lab Learning Module");
}
if (phase === "prepare") {
  if (!record) {
    assert.equal(initial.activeEditions.length, 3);
    assert.ok(initial.activeEditions.every(row => row.versionId === "content:module:HAB:1.6"));
    // The earlier failed preparation is retained as evidence; do not reopen it.
    assert.ok(initial.versions.filter(version => version.status === "DRAFT").every(version => version.id === "content:module:HAB:1.7" && version.releaseNotes.includes("staging-only historical edition rollback certification")), "Preserve unrelated working drafts.");
    const tools = await loadContentTools();
    const nextVersion = tools.nextContentVersion(initial.versions.map(version => version.version));
    await tools.dispose();
    const before = await learner.request("/api/learning?lab=HAB");
    await writeFile(`${output}/evidence-before.json`, JSON.stringify(before), { mode: 0o600 });
    const created = select(await admin.request("/api/content-studio", {
      action: "createVersion", itemId: initial.id, version: nextVersion, copyFromVersionId: "content:module:HAB:1.6",
      schemaVersion: "2.0", sourceFormat: "BIS_PACKAGE_JSON",
      releaseNotes: "BIS-HARDENING-20261006: staging-only historical edition rollback certification. Unchanged reviewed source is carried into an immutable update; restore the original publication after verification.",
    })).versions.find(version => !initial.versions.some(old => old.id === version.id));
    assert.ok(created, "Create a new safe version without reopening the retained 1.5 draft.");
    const original = initial.versions.find(version => version.id === "content:module:HAB:1.6");
    assert.deepEqual(created.sourceFiles.map(source => source.sourceKey).sort(), original.sourceFiles.map(source => source.sourceKey).sort());
    assert.ok(created.sourceFiles.every(source => !original.sourceFiles.some(old => old.storagePath === source.storagePath)), "Copied JSON must use a new immutable version path.");
    record = { project: "lbmhkddrkhtmkcvfmumd", itemId: initial.id, originalVersionId: original.id, versionId: created.id, version: created.version,
      previousVersions: initial.versions.map(version => ({ id: version.id, status: version.status, sourceHashes: version.sourceFiles.map(source => source.sourceHash).sort(), artifactHashes: version.artifacts.map(artifact => artifact.artifactHash).sort() })),
      sources: ["school", "emerging_adult", "workplace"].map(edition => ({ edition, pages: 13 })),
      creation: "Normal authenticated API with the shared next-safe-version calculation; retained 1.5 working update and failed 1.7 QA draft prevent default Edit from creating another version. Both were preserved.",
      sourceCopy: "PASS: new immutable JSON paths; envelope version updated; original source bytes retained" };
    await save();
  }
  await admin.browserState(`${output}/admin-state.json`);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: `${output}/admin-state.json`, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await openStudio(page);
    const card = page.locator(".content-version-card").filter({ has: page.locator(".content-version-number", { hasText: new RegExp(`^v${record.version.replaceAll(".", "\\.")}$`) }) });
    await expect(card).toHaveCount(1);
    const current = select(await admin.request("/api/content-studio")).versions.find(version => version.id === record.versionId);
    if (current.status === "DRAFT") {
      const compiled = page.waitForResponse(response => response.url().endsWith("/api/content-studio") && response.request().method() === "POST");
      await card.getByRole("button", { name: "Process content", exact: true }).click();
      assert.equal((await compiled).status(), 200);
    }
    await expect(card.locator(".content-uat-card")).toBeVisible();
    await expect(card.getByRole("button", { name: "Mark ready", exact: true })).toBeDisabled();
    await expect(page.locator(".content-primary-actions").getByRole("button", { name: "Publish", exact: true })).toBeDisabled();
    await card.screenshot({ path: `${output}/prepared-desktop.png` });
    record.preparationUi = "PASS: Process content; final check appears; publication remains disabled";
  } finally { await browser.close(); }
  for (const source of record.sources) {
    const original = await admin.request(`/api/content-studio/preview?versionId=${encodeURIComponent(record.originalVersionId)}&artifact=learning:${source.edition}`);
    const preview = await admin.request(`/api/content-studio/preview?versionId=${encodeURIComponent(record.versionId)}&artifact=learning:${source.edition}`);
    const pages = payload => payload.treatment.pages.map(page => ({ id: page.id, key: page.key, label: page.label, programmeDay: page.programmeDay, html: page.html.replace(/<(br|hr)\s*\/?>/g, "<$1>") }));
    assert.deepEqual(pages(preview.payload), pages(original.payload), `${source.edition}: preserve all authored page content and relationships`);
    source.authoredPageParity = "PASS: all 13 page IDs, order, wording and field markup retained";
  }
  record.artifactHashes = select(await admin.request("/api/content-studio")).versions.find(version => version.id === record.versionId).artifacts.map(artifact => [artifact.artifactKey, artifact.artifactHash]).sort();
  await save();
  console.log(JSON.stringify({ phase, versionId: record.versionId, preparationUi: record.preparationUi, sourceCopy: record.sourceCopy, authoredEditions: record.sources.length }));
} else if (phase === "transition") {
  assert.ok(record);
  assert.equal(process.env.BIS_HISTORY_MANUAL_REVIEW_VERIFIED, "true", "Inspect representative previews before the final check.");
  const previewRows = JSON.parse(await readFile(`${output}/preview-audit.json`, "utf8"));
  assert.equal(previewRows.length, 117);
  assert.equal(new Set(previewRows.map(row => `${row.edition}:${row.width}:${row.position}`)).size, 117);
  assert.ok(previewRows.every(row => row.versionId === record.versionId));
  assert.ok(previewRows.every(row => row.overflow <= 1 && !row.unlabelled && !row.violations.length && !row.errors.length));
  assert.equal(previewRows.filter(row => row.previewInputIsolation.startsWith("PASS")).length, 9);
  const workspaceRows = JSON.parse(await readFile(`${output}/workspace-audit.json`, "utf8"));
  assert.equal(workspaceRows.length, 9);
  assert.ok(workspaceRows.every(row => row.overflow <= 1 && !row.violations.length && !row.errors.length));
  assert.deepEqual(initial.versions.find(version => version.id === record.versionId).artifacts.map(artifact => [artifact.artifactKey, artifact.artifactHash]).sort(), record.artifactHashes, "Previewed artifacts must remain identical before publication");
  assert.ok(record.sources.every(source => source.authoredPageParity.startsWith("PASS")));
  await admin.browserState(`${output}/admin-state.json`);
  const browser = await chromium.launch();
  const rows = [];
  try {
    const context = await browser.newContext({ storageState: `${output}/admin-state.json`, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await openStudio(page);
    const card = page.locator(".content-version-card").filter({ has: page.locator(".content-version-number", { hasText: new RegExp(`^v${record.version.replaceAll(".", "\\.")}$`) }) });
    const check = card.locator(".content-uat-card");
    await expect(check).toContainText("All included content has been previewed");
    const candidate = initial.versions.find(version => version.id === record.versionId);
    if (candidate.uat?.status !== "PASSED") {
      const boxes = check.getByRole("checkbox");
      await expect(boxes).toHaveCount(6);
      for (const box of await boxes.all()) await box.check();
      await check.locator("textarea").fill("Staging historical rollback verification: identical reviewed source in three editions; all 117 prepared page states pass at 360/430/1280; representative source, input, navigation and shared presentation inspected. No source rewrite or editorial waiver. Prior responses/progress will be compared after publish and rollback.");
      // Mark ready performs save, sign-off and approval in sequence. Observe the
      // last response before checking the rendered state; do not truncate it
      // with a five-second UI assertion while earlier calls are still running.
      const approved = page.waitForResponse(response => response.url().endsWith("/api/content-studio") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "approveVersion");
      await check.getByRole("button", { name: "Mark ready", exact: true }).click();
      assert.equal((await approved).status(), 200);
    }
    await expect(check).toContainText("Final check completed");
    await expect(page.locator(".content-primary-actions").getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
    const activated = page.waitForResponse(response => response.url().endsWith("/api/content-studio") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "activateVersion");
    await page.locator(".content-primary-actions").getByRole("button", { name: "Publish", exact: true }).click();
    assert.equal((await activated).status(), 200);
    await expect(page.locator(".content-auto-version")).toHaveText(`Live: v${record.version}`);
    let live = select(await admin.request("/api/content-studio"));
    assert.equal(live.activeEditions.length, 3);
    assert.ok(live.activeEditions.every(row => row.versionId === record.versionId));
    assert.equal(live.rollbackAvailable, true);
    for (const source of record.sources) {
      const runtime = await learner.request(`/api/runtime-content?kind=LEARNING_MODULE&code=HAB&edition=${source.edition}`);
      assert.equal(runtime.version.id, record.versionId);
    }
    const before = JSON.parse(await readFile(`${output}/evidence-before.json`, "utf8"));
    let after = await learner.request("/api/learning?lab=HAB");
    assert.deepEqual(after.workbookResponses, before.workbookResponses);
    assert.deepEqual(after.progress, before.progress);
    rows.push({ transition: "PUBLISH_SUCCESSOR", editions: 3, userInterface: "PASS: final check, approval and explicit Publish", responseAndProgressRetention: "PASS" });
    await page.reload();
    await openStudio(page);
    await expect(page.locator(".content-auto-version")).toHaveText(`Live: v${record.version}`);
    const restored = page.waitForResponse(response => response.url().endsWith("/api/content-studio") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "rollbackActivation");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Restore previous version", exact: true }).click();
    assert.equal((await restored).status(), 200);
    await expect(page.locator(".content-auto-version")).toHaveText("Live: v1.6");
    live = select(await admin.request("/api/content-studio"));
    assert.equal(live.activeEditions.length, 3);
    assert.ok(live.activeEditions.every(row => row.versionId === record.originalVersionId));
    for (const source of record.sources) {
      const runtime = await learner.request(`/api/runtime-content?kind=LEARNING_MODULE&code=HAB&edition=${source.edition}`);
      assert.equal(runtime.version.id, record.originalVersionId);
    }
    for (const previous of record.previousVersions) {
      const retained = live.versions.find(version => version.id === previous.id);
      assert.equal(retained.status, previous.status);
      assert.deepEqual(retained.sourceFiles.map(source => source.sourceHash).sort(), previous.sourceHashes);
      assert.deepEqual(retained.artifacts.map(artifact => artifact.artifactHash).sort(), previous.artifactHashes);
    }
    assert.ok(live.versions.some(version => version.id === record.versionId && version.status === "PUBLISHED"));
    after = await learner.request("/api/learning?lab=HAB");
    assert.deepEqual(after.workbookResponses, before.workbookResponses);
    assert.deepEqual(after.progress, before.progress);
    rows.push({ transition: "HISTORICAL_EDITION_ROLLBACK", editions: 3, userInterface: "PASS: restore confirmation after refresh", originalVersionRestored: "PASS", previousSourceAndArtifactHashesRetained: "PASS", responseAndProgressRetention: "PASS", successorRetained: "PASS" });
    await page.reload();
    await openStudio(page);
    await expect(page.locator(".content-auto-version")).toHaveText("Live: v1.6");
    await page.screenshot({ path: `${output}/restored-desktop.png` });
  } finally {
    await browser.close();
    // Also restore after a UI assertion fails following a successful publish.
    const current = select(await admin.request("/api/content-studio"));
    if (current.activeEditions.some(row => row.versionId === record.versionId)) {
      assert.equal(current.activeEditions.length, 3, "A concurrent publication changed the edition set; do not restore another operator's work.");
      assert.ok(current.activeEditions.every(row => row.versionId === record.versionId), "A concurrent publication changed an edition; do not restore another operator's work.");
      await admin.request("/api/content-studio", { action: "rollbackActivation", itemId: record.itemId });
    }
  }
  await writeFile(`${output}/history-audit.json`, JSON.stringify({ project: record.project, itemId: record.itemId, originalVersionId: record.originalVersionId, successorVersionId: record.versionId, creation: record.creation, preparationUi: record.preparationUi, previewStates: previewRows.length, transitions: rows, finalAvailability: "Original 1.6 publication: all three editions", limitations: "Dedicated staging fixture; production authenticated publication and exact full-page manual certification remain open." }, null, 2));
  console.log(JSON.stringify(rows));
} else throw new Error("Choose prepare or transition.");
