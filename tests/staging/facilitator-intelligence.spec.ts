import { expect, test } from "@playwright/test";
import { observeFailures, signIn } from "./support";

test("prepared facilitator sees actionable structural guidance at every certification viewport", async ({ page }, testInfo) => {
  const clean = observeFailures(page);
  await signIn(page, "facilitator");
  await page.goto("/workspace?view=facilitator&section=participants");
  await page.waitForLoadState("networkidle");
  const guidance = "Support completion of the existing Phase A tasks. Progress alone does not establish readiness or an outcome.";
  await expect(page.getByLabel("Find a learner")).toBeVisible();
  await expect(page.getByText(guidance, { exact: true })).toHaveCount(0);
  for (const width of [360, 430, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Facilitator overflow at ${width}px`).toBeLessThanOrEqual(1);
    await testInfo.attach(`${width}px-facilitator`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  }
  await page.getByRole("button", { name: /^Open learner:/ }).first().click();
  await expect(page.getByRole("heading", { name: "Next useful facilitator moves" })).toBeVisible();
  await expect(page.getByText(guidance, { exact: true })).toBeVisible();
  clean();
});
