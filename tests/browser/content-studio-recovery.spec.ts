import { expect, test, type Page } from "@playwright/test";

const snapshot = {
  metrics: { learningModules: 34, labs: 32, drafts: 1, live: 31, ready: 1, compiled: 31, activeDynamic: 29 },
  items: [{
    id: "content:module:TRU",
    kind: "LEARNING_MODULE",
    code: "TRU",
    slug: "trust",
    title: "Trust Lab™ Learning Module",
    summary: "Trust learning material",
    routePath: "/handbooks/tru",
    linkedLabItemId: "content:lab:TRU",
    status: "ACTIVE",
    rollbackAvailable: false,
    activeActivation: null,
    activeEditions: [{
      id: "edition-live",
      deliveryEdition: "school",
      versionId: "content:module:TRU:1.0",
      activatedAt: "2026-10-03T12:00:00Z",
    }],
    versions: [
      {
        id: "content:module:TRU:1.1",
        itemId: "content:module:TRU",
        version: "1.1",
        deliveryEditions: ["school"],
        validationStatus: "VALID",
        runtimeStatus: "READY",
        status: "VALIDATED",
        releaseNotes: "Updated learning module",
        compilerStatus: "COMPILED",
        compilerCurrent: true,
        compilerReport: {
          summary: "Prepared 1 learning edition for preview.",
          requiredEditions: ["school"],
          artifactKeys: ["learning:school"],
        },
        compiledAt: "2026-10-04T01:00:00Z",
        sourceFiles: [{
          id: "source-1",
          versionId: "content:module:TRU:1.1",
          sourceKey: "school",
          deliveryEdition: "school",
          sourceFormat: "DOCX",
          fileName: "trust-school.docx",
          storagePath: "sources/tru/1.1/school.docx",
          sourceHash: "abc",
          sourceBytes: 1024,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }],
        artifacts: [{
          id: "artifact-1",
          artifactKey: "learning:school",
          deliveryEdition: "school",
          artifactHash: "hash",
          artifactBytes: 2048,
        }],
        uat: {
          id: "uat-1",
          artifactFingerprint: "fingerprint",
          previewedArtifacts: ["learning:school"],
          checklist: {
            authored_content: true,
            navigation: true,
            inputs_privacy: true,
            responsive: true,
            handoff_completion: true,
            learner_language: true,
          },
          notes: "",
          status: "PASSED",
          reviewedBy: "admin",
          reviewedAt: "2026-10-04T01:30:00Z",
          updatedAt: "2026-10-04T01:30:00Z",
        },
        createdAt: "2026-10-04T00:00:00Z",
        updatedAt: "2026-10-04T01:30:00Z",
      },
      {
        id: "content:module:TRU:1.0",
        itemId: "content:module:TRU",
        version: "1.0",
        deliveryEditions: ["school"],
        validationStatus: "VALID",
        runtimeStatus: "LIVE",
        status: "PUBLISHED",
        releaseNotes: "",
        compilerStatus: "COMPILED",
        compilerCurrent: true,
        compilerReport: { summary: "Published." },
        compiledAt: "2026-10-03T10:00:00Z",
        sourceFiles: [],
        artifacts: [],
        uat: null,
        createdAt: "2026-10-03T09:00:00Z",
        updatedAt: "2026-10-03T12:00:00Z",
      },
    ],
  }],
};

async function openStudio(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.route("**/api/content-studio", route => route.fulfill({ json: snapshot }));
  await page.goto("/content-studio");
  await expect(page.getByRole("heading", { name: "Trust Lab™ Learning Module" })).toBeVisible();
}

test("Content Studio primary actions stay usable at the supported viewport", async ({ page }) => {
  const viewport = page.viewportSize()!;
  await openStudio(page, viewport.width, viewport.height);
  await expect(page.getByRole("heading", { name: "Published to learners" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit content/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Preview/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Publish$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Unpublish/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the operator can publish, take offline, restore, and recover from a failed transition", async ({ page }) => {
  const state = structuredClone(snapshot);
  const actions: string[] = [];
  let failNext = false;
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/api/content-studio", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      actions.push(body.action);
      if (failNext) {
        failNext = false;
        await route.fulfill({ status: 400, json: { error: "The content operation could not be completed. Please try again." } });
        return;
      }
      const item = state.items[0];
      const version = item.versions.find(entry => entry.id === body.versionId);
      if (body.action === "approveVersion") version!.status = "APPROVED";
      if (body.action === "activateVersion" || body.action === "republishVersion") {
        for (const entry of item.versions) entry.runtimeStatus = "READY";
        version!.status = "PUBLISHED";
        version!.runtimeStatus = "LIVE";
        item.rollbackAvailable = body.action === "activateVersion";
        item.activeEditions = [{ id: "edition-restored", deliveryEdition: "school", versionId: version!.id, activatedAt: "2026-10-04T12:00:00Z" }];
      }
      if (body.action === "rollbackActivation") {
        for (const entry of item.versions) entry.runtimeStatus = "READY";
        item.versions[1].runtimeStatus = "LIVE";
        item.activeEditions = [{ id: "edition-previous", deliveryEdition: "school", versionId: item.versions[1].id, activatedAt: "2026-10-03T12:00:00Z" }];
        item.rollbackAvailable = false;
      }
      if (body.action === "unpublishItem") {
        item.activeEditions = [];
        for (const entry of item.versions) entry.runtimeStatus = "READY";
      }
    }
    await route.fulfill({ json: state });
  });
  await page.goto("/content-studio");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect.poll(() => actions).toEqual(["approveVersion", "activateVersion"]);
  await expect(page.getByText("Live: v1.1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore previous version", exact: true }).click();
  await expect(page.getByText("Live: v1.0", { exact: true })).toBeVisible();
  failNext = true;
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByText("The content operation could not be completed. Please try again.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published to learners" })).toBeVisible();
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Currently offline" })).toBeVisible();
  await page.getByRole("button", { name: "Republish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Published to learners" })).toBeVisible();
  await expect(page.getByText("Live: v1.1", { exact: true })).toBeVisible();
  expect(actions.at(-1)).toBe("republishVersion");
});
