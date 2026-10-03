import { expect, test, type Page } from "@playwright/test";
import type { HabitProgramme } from "../../lib/programme-handbook";

const programme: HabitProgramme = {
  schemaVersion: "2.0", handbookId: "browser-learning", labCode: "LDR", slug: "leadership", title: "Leadership handbook", subtitle: "Learning specimen", contentVersion: "1.0", runtimeVersion: "1.0", edition: "school",
  sourceTrace: { authority: "Browser acceptance specimen", prototype: "shared player", rule: "Keep workbook answers stable" },
  treatment: { label: "Learner", sourceId: "browser-source", contentHash: "browser-fingerprint", privacySummary: "Private", pages: [
    { id: "LDR.PROGRAMME.DAY3", key: "day-3", label: "Day 3", phase: "LAB", programmeDay: 3, experimentPosition: null, html: "<h1>Day 3 · Leadership</h1><p>Today’s learning connects to your Lab.</p>" },
    { id: "LDR.PROGRAMME.DAY4", key: "day-4", label: "Day 4", phase: "LEARN_EXPERIMENT", programmeDay: 4, experimentPosition: null, html: "<h1>Day 4 · Evidence</h1><p>Look for one real example.</p>" },
  ] },
};

async function learningService(page: Page, recorded = false) {
  const snapshot = { profile: { displayName: "Browser learner", deliveryEdition: "school", deliveryContext: "school", language: "en", timezone: "Africa/Johannesburg" }, releases: [{ id: "browser-release", labCode: "LDR", contentVersion: "1.0", status: "ACTIVE" }], progress: [], workbookResponses: {} };
  await page.route("**/api/learning**", route => route.fulfill({ json: snapshot }));
  await page.route("**/api/bis", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/runtime-content**", route => route.fulfill({ json: { payload: programme } }));
  await page.route("**/api/universal-lab**", route => route.fulfill({ json: {
    enrolment: { currentInvestigation: 7, status: "IN_PROGRESS", phaseACompletedAt: "2026-10-02T10:00:00Z", experimentStartedAt: "2026-10-02T10:00:00Z" },
    measurements: {}, responses: {}, programmeHandoff: { experimentStarted: true, currentDay: 2, totalDays: 7, evidenceDaysRecorded: recorded ? 2 : 1, todayEvidenceRecorded: recorded },
  } }));
}

test("Today reminder offers only current evidence and carries the learning location", async ({ page }) => {
  await learningService(page);
  await page.goto("/learn?page=1");
  const reminder = page.getByRole("status").filter({ hasText: "Today’s Lab evidence" });
  await expect(reminder.getByRole("heading", { name: "Experiment Day 2 is ready." })).toBeVisible();
  const link = reminder.getByRole("link", { name: "Capture today’s evidence" });
  const href = await link.getAttribute("href");
  const destination = new URL(href!, "http://127.0.0.1:3100");
  expect(destination.pathname).toBe("/labs/ldr");
  expect(destination.searchParams.get("returnTo")).toBe("/learn?section=learn&page=1");
});

test("Today stops asking for an evidence day already recorded", async ({ page }) => {
  await learningService(page, true);
  await page.goto("/learn?page=1");
  await expect(page.getByText("2/7 observation days recorded.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture today’s evidence" })).toHaveCount(0);
});

test("browser Back restores the previous learning page", async ({ page }) => {
  await learningService(page, true);
  await page.goto("/learn?section=learn&page=1");
  await expect(page.getByRole("heading", { name: "Day 3 · Leadership", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete & continue", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { name: "Day 4 · Evidence", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole("heading", { name: "Day 3 · Leadership", exact: true })).toBeVisible();
});
