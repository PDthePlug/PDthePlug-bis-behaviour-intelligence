import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadContentTools } from "../../scripts/lib/load-content-tools.mjs";

test("Trust manuscript uses the real shared reader without duplicate cover, fences or baseline answers", async ({ page }, info) => {
  const tools = await loadContentTools();
  let payload;
  try {
    const bytes = await readFile("content/learning-sources/trust-school-v1.1-authored.md");
    const adapted = await tools.adaptLearningSource(bytes, "MARKDOWN", "TRU", "1.1", "school", { title: "Trust Lab™", slug: "trust" });
    payload = JSON.parse((await tools.compileLearningEdition(adapted, "TRU", "1.1", "school")).content);
  } finally { await tools.dispose(); }
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/content-studio/preview?**", route => route.fulfill({ json: { payload, version: { version: "1.1" } } }));
  await page.goto("/trust-reader");
  await expect(page.getByRole("heading", { name: "Welcome", exact: true })).toHaveCount(1);
  const root = page.locator(".prototype-document");
  const about = root.getByText("About this handbook", { exact: true });
  await expect(about).toBeVisible();
  await expect(root.getByText("TRUST LAB™", { exact: true })).toBeHidden();
  await about.click();
  await expect(root.getByText("TRUST LAB™", { exact: true })).toBeVisible();
  await about.click();
  await expect(root.locator("select.workbook-choice-response")).toHaveCount(10);
  expect(await root.innerText()).not.toContain("```");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await info.attach("trust-welcome", { body: await page.screenshot(), contentType: "image/png" });
  await page.goto("/trust-reader?page=2");
  await expect(page.getByRole("heading", { name: "Seeing Trust", exact: true })).toHaveCount(1);
  await expect(root.getByRole("heading", { name: "DAY 1", exact: true })).toHaveCount(0);
  await expect(root.getByRole("heading", { name: "What Is Trust?", exact: true })).toBeVisible();
  const outline = root.locator("details.handbook-session-details").filter({ hasText: "Session outline" });
  await expect(outline).toHaveCount(1);
  await expect(outline.locator(".handbook-source-callout")).toBeHidden();
  await outline.locator("summary").click();
  await expect(outline.locator(".handbook-source-callout")).toBeVisible();
  await expect(outline).toContainText("YOU WILL NEED:");
  await outline.locator("summary").click();
  await expect(root.locator('textarea[aria-label="Your answer: 🧠 What Is Trust?"]')).toHaveCount(0);
  const menu = page.getByRole("button", { name: "Open BIS menu" });
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await info.attach("trust-day-one", { body: await page.screenshot(), contentType: "image/png" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Seeing Trust", exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
});
