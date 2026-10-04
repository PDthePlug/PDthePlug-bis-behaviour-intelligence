import { expect, test } from "@playwright/test";

test("facilitator support uses structural evidence without treating progress as readiness", async ({ page }) => {
  await page.goto("/workspace?section=participants&group=cohort");
  await expect(page.getByText("Preparing the experiment", { exact: true })).toBeVisible();
  const guidance = "Support completion of the existing Phase A tasks. Progress alone does not establish readiness or an outcome.";
  await expect(page.getByText(guidance, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open learner →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Next useful facilitator moves" })).toBeVisible();
  await expect(page.getByText(guidance, { exact: true })).toBeVisible();
  await expect(page.getByText("Ready to start experiment", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
