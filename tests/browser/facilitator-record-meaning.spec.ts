import { test, expect } from "@playwright/test";

const cohort = { id: "group", name: "Recorded activity fixture", labCode: "SYS", labVersion: "1", status: "ACTIVE", memberIds: ["learner"] };
const learner = { userId: "learner", cohortId: "group", displayName: "Browser learner", email: "learner@local.invalid", enrolment: { id: "enrolment", status: "ACTIVE", currentInvestigation: 7, labVersion: "1", experimentStartedAt: "2026-10-01T00:00:00Z" }, experiment: null };

for (const scenario of ["zero", "two", "unavailable"] as const) test(`facilitator describes ${scenario} opportunity records without inferring behaviour`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const participant = { ...learner, enrolment: { ...learner.enrolment, status: scenario === "unavailable" ? "COMPLETED" : "ACTIVE" }, experiment: scenario === "unavailable" ? null : { status: "ACTIVE", recordedDays: 3, opportunityCount: scenario === "zero" ? 0 : 2, minimumEvidenceThreshold: 3 } };
  await page.route("**/api/staff", route => route.fulfill({ json: { identity: { id: "staff", displayName: "Staff", email: "staff@local.invalid" }, roles: ["FACILITATOR"], privacyBoundary: {}, admin: null, facilitator: { cohorts: [cohort], learners: [participant], notes: [], referrals: [] }, sponsor: null, safeguarding: null } }));
  await page.goto("/staff-shell?view=facilitator&section=participants&group=group&learner=learner");
  await expect(page.getByRole("heading", { name: "Browser learner", exact: true })).toBeVisible();
  const activity = page.locator(".ops-section").filter({ has: page.getByRole("heading", { name: "What the programme record shows", exact: true }) });
  await expect(activity.getByText("Recorded activity", { exact: true })).toBeVisible();
  await expect(activity).toContainText("It does not establish evidence quality, ability or behaviour change.");
  await expect(page.getByText("Repeated real-world testing", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No real-world opportunity yet", { exact: true })).toHaveCount(0);
  if (scenario === "zero") {
    await expect(page.getByRole("heading", { name: "No opportunity recorded yet", exact: true })).toBeVisible();
    await expect(page.getByText("Ask what real situations were available and whether the test needs adjusting", { exact: true })).toBeVisible();
  } else if (scenario === "two") {
    await expect(activity.getByText("2 suitable real-world situations recorded", { exact: true })).toBeVisible();
    await expect(activity.getByText("3 observation days recorded", { exact: true })).toBeVisible();
  } else {
    await expect(activity.getByText("Completed the Lab", { exact: true })).toBeVisible();
    await expect(page.getByText("Completed the learning cycle", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Move from planning to the first real-world test", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Practice started · detail not available", { exact: true })).toBeVisible();
  }
  await page.reload(); await expect(activity).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
