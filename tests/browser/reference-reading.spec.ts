import { test, expect } from "@playwright/test";

const programme = {
  schemaVersion: "2.0", handbookId: "reference-reading", labCode: "LDR", slug: "leadership", title: "Leadership handbook", subtitle: "Reading fixture", contentVersion: "1", runtimeVersion: "1", edition: "school",
  sourceTrace: { authority: "Browser fixture", prototype: "shared reader", rule: "Preserve answers" },
  treatment: { label: "Learner", sourceId: "reading", contentHash: "reading", privacySummary: "Private", pages: [
    { id: "LDR.PROGRAMME.DAY3", key: "Day 3", label: "Day 3", phase: "LAB", programmeDay: 3, experimentPosition: null, html: "<p>Prepare for the Lab.</p>" },
    { id: "LDR.PROGRAMME.DAY4", key: "Day 4", label: "Day 4", phase: "LEARN_EXPERIMENT", programmeDay: 4, experimentPosition: null, html: '<p>What did you notice?</p><textarea class="response" data-field-id="LDR.WB.DAY4.ORIGINAL" data-source-key="original" data-purpose="LEARNING_RESPONSE"></textarea><p>Bring these notes:</p><ul class="source-list"><li>The situation</li><li>The action</li></ul><p>Check them in this order:</p><ol class="source-list"><li>Read the record</li><li>Check the context</li></ol>' },
  ] },
};

for (const published of [false, true]) test(`reference responses remain locked when the Lab is ${published ? "published without recorded evidence" : "unavailable"}`, async ({ page }) => {
  const errors: string[] = [], writes: unknown[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/learning**", async route => {
    if (route.request().method() === "POST") writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { profile: { displayName: "Browser learner", deliveryEdition: "school" }, releases: [], progress: [], workbookResponses: {} } });
  });
  await page.route("**/api/lab-runtime**", route => route.fulfill({ json: { runtimeMode: published ? "DYNAMIC" : null, roles: [] } }));
  await page.route("**/api/universal-lab**", route => route.fulfill({ json: { enrolment: { status: "IN_PROGRESS", currentInvestigation: 3 }, measurements: {}, responses: {}, programmeHandoff: { experimentStarted: false, evidenceDaysRecorded: 0 } } }));
  await page.route("**/api/profile", route => route.fulfill({ json: { profile: { textSizePreference: "standard" } } }));
  await page.route("**/api/runtime-content**", route => route.fulfill({ json: { payload: programme } }));
  await page.goto("/learn?section=learn&page=2");
  const status = page.locator(".learner-document-status");
  await expect(status).toHaveText("Reference view · you can read this page, but cannot add responses yet");
  const answer = page.locator('[data-field-id="LDR.WB.DAY4.ORIGINAL"]');
  await expect(answer).toBeDisabled();
  await expect(page.getByRole("button", { name: published ? "Record Lab evidence first" : "Continue after the Lab", exact: true })).toBeDisabled();
  const unordered = page.locator("ul.source-list"), ordered = page.locator("ol.source-list");
  expect(await unordered.evaluate(element => getComputedStyle(element).listStyleType)).toBe("disc");
  expect(await ordered.evaluate(element => getComputedStyle(element).listStyleType)).toBe("decimal");
  await expect(unordered.getByRole("listitem")).toHaveText(["The situation", "The action"]);
  await expect(ordered.getByRole("listitem")).toHaveText(["Read the record", "Check the context"]);
  await page.reload(); await expect(status).toContainText("cannot add responses yet"); await expect(answer).toBeDisabled();
  expect(writes).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
