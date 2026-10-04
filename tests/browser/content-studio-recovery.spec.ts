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
          previewedArtifacts: [],
          checklist: {},
          notes: "",
          status: "IN_REVIEW",
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: "2026-10-04T01:00:00Z",
        },
        createdAt: "2026-10-04T00:00:00Z",
        updatedAt: "2026-10-04T01:00:00Z",
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
  await page.route("**/api/content-studio", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: snapshot });
    return route.fulfill({ json: snapshot });
  });
  await page.goto("/content-studio");
  await expect(page.getByRole("heading", { name: "Trust Lab™ Learning Module" })).toBeVisible();
}

for (const viewport of [
  { name: "360px", width: 360, height: 800 },
  { name: "430px", width: 430, height: 932 },
  { name: "1280px", width: 1280, height: 900 },
]) {
  test(`Content Studio publishing controls stay usable at ${viewport.name}`, async ({ page }) => {
    await openStudio(page, viewport.width, viewport.height);
    await expect(page.getByRole("heading", { name: "This title is live" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit this update/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Take offline/i })).toBeVisible();
    await expect(page.getByText("Prepare").first()).toBeVisible();
    await expect(page.getByText("Preview").first()).toBeVisible();
    await expect(page.getByText("Publish").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
