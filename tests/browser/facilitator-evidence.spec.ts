import { expect, test } from "@playwright/test";

test("facilitator support uses structural evidence without treating progress as readiness", async ({ page }) => {
  await page.goto("/workspace?section=participants&group=cohort");
  await expect(page.getByText("Preparing the experiment", { exact: true })).toBeVisible();
  const guidance = "Support completion of the existing Phase A tasks. Progress alone does not establish readiness or an outcome.";
  await expect(page.getByText(guidance, { exact: true })).toHaveCount(0);
  await page.getByLabel("Find a learner").fill("missing name");
  await expect(page.getByRole("status")).toHaveText("0 of 1 learners shown");
  await expect(page.getByRole("button", { name: /^Open learner:/ })).toHaveCount(0);
  await page.getByLabel("Find a learner").fill("Browser");
  await expect(page.getByRole("status")).toHaveText("1 of 1 learners shown");
  await page.getByLabel("Show", { exact: true }).selectOption("completed");
  await expect(page.getByRole("status")).toHaveText("0 of 1 learners shown");
  await page.getByLabel("Show", { exact: true }).selectOption("attention");
  await expect(page.getByRole("status")).toHaveText("1 of 1 learners shown");
  await page.getByRole("button", { name: /^Open learner:/ }).click();
  await expect(page.getByRole("heading", { name: "Next useful facilitator moves" })).toBeVisible();
  await expect(page.getByText(guidance, { exact: true })).toBeVisible();
  await expect(page.getByText("Ready to start experiment", { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByLabel("Find a learner")).toHaveValue("Browser");
  await expect(page.getByLabel("Show", { exact: true })).toHaveValue("attention");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("1 of 1 learners shown");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
