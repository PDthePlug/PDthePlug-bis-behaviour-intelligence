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

async function learningService(page: Page, state: "due" | "recorded" | "review" | "complete" = "due") {
  const recorded = state !== "due";
  const snapshot = { profile: { displayName: "Browser learner", deliveryEdition: "school", deliveryContext: "school", language: "en", timezone: "Africa/Johannesburg" }, releases: [{ id: "browser-release", labCode: "LDR", contentVersion: "1.0", status: "ACTIVE" }], progress: [], workbookResponses: {} };
  await page.route("**/api/learning**", route => route.fulfill({ json: snapshot }));
  await page.route("**/api/lab-runtime**", route => route.fulfill({ json: { runtimeMode: "DYNAMIC", version: "1.0", roles: [] } }));
  await page.route("**/api/profile", route => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/runtime-content**", route => route.fulfill({ json: { payload: programme } }));
  await page.route("**/api/universal-lab**", route => route.fulfill({ json: {
    enrolment: {
      currentInvestigation: state === "complete" ? 9 : state === "review" ? 8 : 7,
      status: state === "complete" ? "COMPLETED" : state === "review" ? "EVIDENCE_REVIEW" : "IN_PROGRESS",
      phaseACompletedAt: "2026-10-02T10:00:00Z",
      experimentStartedAt: "2026-10-02T10:00:00Z",
    },
    measurements: {},
    responses: {},
    programmeHandoff: {
      experimentStarted: true,
      currentDay: state === "review" || state === "complete" ? 8 : 2,
      totalDays: 7,
      evidenceDaysRecorded: state === "review" || state === "complete" ? 7 : recorded ? 2 : 1,
      todayEvidenceRecorded: recorded,
      reviewReady: state === "review",
      reviewInvestigation: 8,
      labCompleted: state === "complete",
      portfolioReady: state === "complete",
      nextAction: state === "complete" ? "PORTFOLIO" : state === "review" ? "REVIEW" : recorded ? "LEARNING" : "EVIDENCE",
    },
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
  await learningService(page, "recorded");
  await page.goto("/learn?page=1");
  await expect(page.getByText("2/7 observation days recorded.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture today’s evidence" })).toHaveCount(0);
});

test("browser Back restores the previous learning page", async ({ page }) => {
  await learningService(page, "recorded");
  await page.goto("/learn?section=learn&page=1");
  await expect(page.getByRole("heading", { name: "Day 3 · Leadership", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete & continue", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { name: "Day 4 · Evidence", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole("heading", { name: "Day 3 · Leadership", exact: true })).toBeVisible();
});


test("learning turns a completed Phase B window into an Evidence Review handoff", async ({ page }) => {
  await learningService(page, "review");
  await page.goto("/learn?page=2");
  const review = page.getByRole("status").filter({ hasText: "Phase B complete" });
  await expect(review.getByRole("heading", { name: "Your real-world test is ready to review." })).toBeVisible();
  const link = review.getByRole("link", { name: "Review my evidence" });
  const href = await link.getAttribute("href");
  const destination = new URL(href!, "http://127.0.0.1:3100");
  expect(destination.pathname).toBe("/labs/ldr");
  expect(destination.searchParams.get("step")).toBe("8");
  await expect(page.getByRole("link", { name: "Capture today’s evidence" })).toHaveCount(0);
});

test("learning closes the loop with the learner evidence portfolio after Lab completion", async ({ page }) => {
  await learningService(page, "complete");
  await page.goto("/learn?page=2");
  await expect(page.getByRole("heading", { name: "Your evidence record is ready." })).toBeVisible();
  await expect(page.getByRole("link", { name: "View my evidence portfolio" })).toHaveAttribute("href", "/profile#evidence-portfolio");
});


test("Learn reader renders through the shared learner-document surface", async ({ page }, info) => {
  await learningService(page, "recorded");
  await page.goto("/learn?section=learn&page=1");

  const surface = page.locator(".learner-document");
  await expect(surface).toBeVisible();
  await expect(surface.locator(".learner-document-header")).toBeVisible();
  await expect(surface.locator(".learner-document-title")).toHaveText("Day 3");
  await expect(surface.locator(".learner-document-purpose")).toBeVisible();
  await expect(surface.locator(".learner-document-body")).toBeVisible();
  await expect(surface.locator(".learner-document-footer")).toBeVisible();

  const geometry = await surface.evaluate((element) => {
    const style = getComputedStyle(element);
    const header = element.querySelector(".learner-document-header")!;
    const body = element.querySelector(".learner-document-body")!;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      background: style.backgroundColor,
      radius: style.borderRadius,
      headerGutter: header.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(header).paddingLeft),
      bodyGutter: body.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(body).paddingLeft),
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.background).toBe("rgb(255, 255, 255)");
  expect(Number.parseFloat(geometry.radius)).toBe(0);
  expect(Math.abs(geometry.headerGutter - geometry.bodyGutter)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath("workbook-canvas-learning.png"), fullPage: true });
});
