import { test, expect } from "@playwright/test";

const slugs = ["habit", "decision", "money", "identity", "attention"];
const editions = ["school", "emerging_adult", "workplace"];

test("weekend context is disclosed while authored actions and original responses remain open", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/reader-hardening");
  await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("Weekend");
  for (const slug of slugs) for (const edition of editions) {
    await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`${slug}-${edition}`);
    const root = page.locator(`[data-specimen="${slug}-${edition}"][data-page-key="Weekend"]`);
    const details = root.locator(".handbook-weekend-details");
    await expect(details).toHaveCount(1); await expect(details).not.toHaveAttribute("open");
    await expect(root.getByRole("heading", { name: "WEEKEND", exact: true })).toHaveCount(0);
    await expect(root.getByRole("heading", { name: "Field Experiment", exact: true })).toHaveCount(0);
    await expect(root.getByRole("heading", { name: "What to do", exact: true })).toBeVisible();
    await expect(details.locator("input,textarea,select,button,[data-field-id]")).toHaveCount(0);
    const actions = root.locator("ul.source-list").first();
    await expect(actions.locator(":scope > li:visible")).toHaveCount(4);
    expect(await actions.evaluate(list => getComputedStyle(list).listStyleType)).toBe("disc");
    await details.locator(":scope > summary").focus(); await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", ""); await expect(details).toContainText("Days 4–5 of 7"); await expect(details).toContainText("No session");
    await page.keyboard.press("Enter"); await expect(details).not.toHaveAttribute("open");
    await expect(root.getByRole("textbox").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("certificate source lists retain semantics while internal production footers leave the learner canvas", async ({ page }) => {
  await page.goto("/reader-hardening");
  await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("Certificate");
  for (const slug of slugs) for (const edition of editions) {
    await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`${slug}-${edition}`);
    const root = page.locator(`[data-specimen="${slug}-${edition}"][data-page-key="Certificate"]`);
    await expect(root).toBeVisible();
    expect(await root.innerText()).not.toMatch(/Controlled Production Master|Architecture frozen|Production.freeze/i);
    await expect(root.getByRole("heading", { name: "CERTIFICATE", exact: true })).toHaveCount(0);
    const list = root.locator("ul.source-list,ul.handbook-authored-list").first(); await expect(list).toBeVisible();
    expect(await list.locator(":scope > li").count()).toBeGreaterThanOrEqual(4);
    expect(await list.evaluate(element => getComputedStyle(element).listStyleType)).toBe("disc");
    const originals = root.locator(".handbook-production-metadata");
    for (const original of await originals.all()) { await expect(original).toBeHidden(); await expect(original).toHaveAttribute("aria-hidden", "true"); }
    await expect(root.getByRole("textbox").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("checkpoint titles avoid decorative completion markers and choice responses use their authored introduction", async ({ page }, info) => {
  await page.goto("/reader-hardening");
  await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("10");
  for (const edition of editions) {
    await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`attention-${edition}`);
    const root = page.locator(`[data-specimen="attention-${edition}"][data-day="10"]`);
    const checkpoint = root.getByRole("heading", { name: "Final Checkpoint", exact: true });
    await expect(checkpoint).toBeVisible();
    const decoration = checkpoint.locator(".handbook-heading-decoration"); await expect(decoration).toBeHidden(); await expect(decoration).toContainText("✅");
    const response = root.getByRole("textbox", { name: "Continue your investigation with another Lab in the series:", exact: true });
    await expect(response).toHaveCount(1); await expect(response).toHaveAttribute("data-field-id", /ATT\.WB\..+\.DAY10\./);
    await expect(root.getByRole("textbox", { name: "☐ Resilience Lab — How do I get back up?", exact: true })).toHaveCount(0);
    await response.fill("Keep my next Lab response."); const id = await response.getAttribute("data-field-id");
    await page.reload();
    // Specimen selectors are harness controls, not product URL state. Restore
    // the specimen after refresh before verifying the original saved answer.
    await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("10");
    await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`attention-${edition}`);
    await expect(page.locator(`[data-field-id="${id}"]`)).toHaveValue("Keep my next Lab response.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: info.outputPath("attention-response-context.png") });
});
