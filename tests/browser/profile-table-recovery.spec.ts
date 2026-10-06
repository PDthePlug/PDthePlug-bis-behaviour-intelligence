import { test, expect } from "@playwright/test";

test("all six accepted profile sections retain their labels without invented answer fields", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/reader-hardening");
  await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("10");
  for (const slug of ["identity", "attention"]) for (const edition of ["school", "emerging_adult", "workplace"]) {
    await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`${slug}-${edition}`);
    const root = page.locator(`[data-specimen="${slug}-${edition}"][data-day="10"]`);
    const table = root.locator(".handbook-profile-table");
    await expect(table).toHaveCount(1);
    await expect(table.locator("thead th")).toHaveText(["Element", "My Answer"]);
    await expect(table.locator("tbody tr").first().locator('th[scope="row"]')).toContainText(slug === "identity" ? "Self-Claim Investigated" : "Attention Pattern Investigated");
    expect(await table.locator("tbody tr").count()).toBeGreaterThan(15);
    await expect(table.locator("input,textarea,select,[data-field-id]")).toHaveCount(0);
    await expect(root.locator('[data-profile-table-header="true"]')).toBeHidden();
    await expect(table).toContainText("A dash means the value is not available in this view.");
    expect(await table.locator("tbody td").allTextContents()).toEqual(Array(await table.locator("tbody tr").count()).fill("—"));
    expect(await table.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("profile grouping preserves resolved zeroes, negative self-report and original response identities", async ({ page }, info) => {
  await page.goto("/profile-table-structure");
  const table = page.getByRole("table", { name: "My investigation profile", exact: true });
  await expect(table.getByRole("row", { name: "Recorded zero 0 Recorded source count" })).toBeVisible();
  await expect(table.getByRole("row", { name: "Reported change -2 Paired self-report answers" })).toBeVisible();
  await expect(table.getByLabel("Not available in this view", { exact: true })).toHaveCount(1);
  const response = page.locator('[data-field-id="SYS.WB.ORIGINAL"]');
  await response.fill("Keep this existing private response.");
  await page.getByRole("button", { name: "Apply presentation again", exact: true }).click();
  await expect(table).toHaveCount(1);
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table.locator("input,textarea,select")).toHaveCount(0);
  await expect(response).toHaveValue("Keep this existing private response.");
  await expect(response).toHaveAttribute("data-source-key", "original");
  await expect(table.getByRole("row", { name: "Recorded zero 0 Recorded source count" })).toBeVisible();
  await expect(table.getByRole("row", { name: "Reported change -2 Paired self-report answers" })).toBeVisible();
  await table.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath("profile-recovery.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
