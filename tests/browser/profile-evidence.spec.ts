import { expect, test, type Page } from "@playwright/test";

async function profileService(page: Page) {
  await page.route("**/api/profile", route => route.fulfill({
    json: {
      identity: { email: "browser.learner@example.test", displayName: "Browser Learner" },
      roles: [],
      profile: {
        displayName: "Browser Learner",
        ageBand: "18-21",
        mode: "FACILITATED",
        deliveryEdition: "school",
      },
    },
  }));

  await page.route("**/api/evidence-portfolio", route => route.fulfill({
    json: {
      labs: [{
        enrolmentId: "browser-enrolment",
        labCode: "HAB",
        labVersion: "4.5.2",
        title: "Habit Lab",
        status: "COMPLETED",
        currentInvestigation: 9,
        completedAt: "2026-10-08T12:00:00Z",
        intelligence: { summary: "Use linked records to distinguish observation and interpretation.", boundary: "One Lab does not prove lasting change.", nextAction: { label: "Revisit your evidence and transfer plan", investigation: 9, reason: "Use your existing transfer record." } },
        anchors: [
          { id: "BASELINE", label: "Starting point", status: "RECORDED", evidenceCount: 2 },
          { id: "PHASE_A", label: "Phase A", status: "RECORDED", evidenceCount: 8 },
          { id: "EXPERIMENT", label: "Real-world test", status: "RECORDED", evidenceCount: 7 },
          { id: "REVIEW", label: "Evidence review", status: "RECORDED", evidenceCount: 3 },
          { id: "PROFILE", label: "Behaviour Profile", status: "RECORDED", evidenceCount: 4 },
        ],
        metrics: [
          { code: "HAB.BEI03", label: "Prediction accuracy", value: "82%", evidenceStrength: "SUFFICIENT_FOR_LAB", sourceCount: 2, provenanceStatus: "VERIFIED" },
          { code: "HAB.BEI06", label: "Observed adherence", value: "71%", evidenceStrength: "SUFFICIENT_FOR_LAB", sourceCount: 7, provenanceStatus: "VERIFIED" },
          { code: "HAB.CONTROL_SHIFT", label: "Control shift", value: "+2", evidenceStrength: "SUFFICIENT_FOR_LAB", sourceCount: 2, provenanceStatus: "VERIFIED" },
        ],
        summary: {
          recordedAnchors: 5,
          totalAnchors: 5,
          activeEvidenceItems: 24,
          derivedMeasures: 3,
          sourceLinks: 11,
        },
      }],
      privacy: {
        note: "The portfolio shows evidence structure and derived measures. Private response wording remains in the learner's Lab record.",
      },
    },
  }));
}

test("evidence portfolio stays readable and private across supported viewports", async ({ page }) => {
  await profileService(page);
  await page.goto("/profile#evidence-portfolio");

  await expect(page.getByRole("heading", { name: "Your evidence portfolio" })).toBeVisible();
  await expect(page.getByText("Habit Lab", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Habit Lab evidence anchors")).toContainText("Starting point");
  await expect(page.getByLabel("Habit Lab evidence anchors")).toContainText("Real-world test");
  await expect(page.getByText("Observed adherence", { exact: true })).toBeVisible();
  await expect(page.getByText("71%", { exact: true })).toBeVisible();
  await expect(page.getByText("Your private answer wording stays inside the Lab.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "What your evidence supports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Revisit your evidence and transfer plan" })).toHaveAttribute("href", "/habit-lab");
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});


test("portfolio failure is distinguished from an empty evidence record", async ({ page }) => {
  await profileService(page);
  await page.route("**/api/evidence-portfolio", route => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await page.goto("/profile#evidence-portfolio");
  await expect(page.getByText("Your portfolio could not be loaded. Refresh to try again; saved evidence remains unchanged.")).toBeVisible();
  await expect(page.getByText(/No Lab evidence has been recorded yet/)).toHaveCount(0);
});
