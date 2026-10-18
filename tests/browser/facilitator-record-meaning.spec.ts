import { test, expect } from "@playwright/test";

const cohort = { id: "group", name: "Recorded activity fixture", labCode: "SYS", labVersion: "1", status: "ACTIVE", memberIds: ["learner"] };
const learner = { userId: "learner", cohortId: "group", displayName: "Browser learner", email: "learner@local.invalid", enrolment: { id: "enrolment", status: "ACTIVE", currentInvestigation: 7, labVersion: "1", experimentStartedAt: "2026-10-01T00:00:00Z" }, experiment: null };

for (const scenario of ["zero", "two", "unavailable", "missing"] as const) test(`facilitator describes ${scenario} opportunity records without inferring behaviour`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const participant = { ...learner, enrolment: { ...learner.enrolment, status: scenario === "unavailable" ? "COMPLETED" : "ACTIVE" }, experiment: scenario === "unavailable" ? null : { status: "ACTIVE", recordedDays: 3, opportunityCount: scenario === "missing" ? undefined : scenario === "zero" ? 0 : 2, minimumEvidenceThreshold: 3 } };
  await page.route("**/api/staff", route => route.fulfill({ json: { identity: { id: "staff", displayName: "Staff", email: "staff@local.invalid" }, roles: ["FACILITATOR"], privacyBoundary: {}, admin: null, facilitator: { cohorts: [cohort], learners: [participant], notes: [], referrals: [] }, sponsor: null, safeguarding: null } }));
  await page.route("**/api/facilitator-development?**",route=>route.fulfill({json:{profile:{areas:[]},developmentEvidence:{areas:[],boundary:"Structural evidence only"}}}));
  await page.goto("/staff-shell?view=facilitator&section=participants&group=group&learner=learner");
  await expect(page.getByRole("heading", { name: "Browser learner", exact: true })).toBeVisible();
  await page.getByText("Programme participation and access",{exact:true}).focus();
  await page.keyboard.press("Enter");
  // The operational surface is a named section; use its aria label directly.
  const context = page.locator('[aria-label="Operational context"]');
  await expect(context).toBeVisible();
  await expect(page.getByText("These operational records provide context. They are not the learner's development result.",{exact:true})).toBeVisible();
  await expect(page.getByText("Repeated real-world testing", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No real-world opportunity yet", { exact: true })).toHaveCount(0);
  if (scenario === "zero") await expect(context.getByText("Observations recorded; no matching situation yet",{exact:true})).toBeVisible();
  else if(scenario === "two") {
    await expect(context.getByText("2 real situations recorded",{exact:true})).toBeVisible();
    await expect(context.getByText("3",{exact:true})).toBeVisible();
  } else if(scenario === "missing") await expect(context.getByText("Observation detail not available",{exact:true})).toBeVisible();
  else {
    await expect(page.getByText("Completed",{exact:true})).toBeVisible();
    await expect(context.getByText("Practice started",{exact:true})).toBeVisible();
    await expect(context.getByText("—",{exact:true})).toBeVisible();
  }
  await page.reload(); await page.getByText("Programme participation and access",{exact:true}).focus(); await page.keyboard.press("Enter"); await expect(context).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
