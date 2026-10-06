import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const responseIdentities = JSON.parse(readFileSync(new URL("../fixtures/handbook-response-identities.json", import.meta.url), "utf8")) as Array<{ slug: string; edition: string; day: number; count: number; digest: string }>;

test("real handbook checks follow answers, stay unique after rerenders and restore on refresh", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/reader-hardening");
  const root = page.locator('[data-specimen="money-emerging_adult"][data-day="2"]');
  await expect(root.locator("[data-formative-signal-for]").first()).toBeAttached();
  const counts = await root.evaluate(element => {
    const checks = [...element.querySelectorAll<HTMLElement>("[data-formative-signal-for]")];
    const ids = checks.map(check => check.dataset.formativeSignalFor);
    return { count: checks.length, unique: new Set(ids).size, allHidden: checks.every(check => check.hidden), order: checks.every(check => [...element.querySelectorAll(`[data-response-check="${check.dataset.formativeSignalFor}"]`)].every(field => Boolean(field.compareDocumentPosition(check) & Node.DOCUMENT_POSITION_FOLLOWING))) };
  });
  expect(counts.count).toBeGreaterThan(0);
  expect(counts.count).toBeLessThanOrEqual(4);
  expect(counts.unique).toBe(counts.count);
  expect(counts.allHidden).toBe(true);
  expect(counts.order).toBe(true);
  const field = root.locator("textarea[data-response-check]").first();
  const checkId = await field.getAttribute("data-response-check");
  const fieldId = await field.getAttribute("data-field-id");
  const group = root.locator(`[data-formative-signal-for="${checkId}"]`);
  await field.fill("I compared what was recorded with what I remembered.");
  await expect(group).toBeVisible();
  await group.getByText("I understand this", { exact: true }).click();
  await page.reload();
  await expect(page.locator(`[data-field-id="${fieldId}"]`)).toHaveValue("I compared what was recorded with what I remembered.");
  await expect(group).toBeVisible();
  await expect(group.getByRole("radio", { name: "I understand this", exact: true })).toBeChecked();
  await expect(root.locator("[data-formative-signal-for]")).toHaveCount(counts.count);
  expect(await root.locator("textarea").evaluateAll(fields => new Set(fields.map(field => field.getAttribute("data-field-id"))).size)).toBe(await root.locator("textarea").count());
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await field.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("reader-check-flow.png") });
  expect(errors).toEqual([]);
});

test("Money safety boundary is reading, not an extra answer, across all editions", async ({ page }) => {
  await page.goto("/reader-hardening");
  await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("3");
  for (const edition of ["school", "emerging_adult", "workplace"]) {
    await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`money-${edition}`);
    const root = page.locator(`[data-specimen="money-${edition}"][data-day="3"]`);
    const instruction = edition === "workplace" ? "Additionally, do not use Money Lab to investigate:" : "Do not use Money Lab to experiment with spending that involves:";
    await expect(root).toBeVisible();
    await expect(root.getByRole("textbox", { name: instruction, exact: true })).toHaveCount(0);
    await expect(root.getByText(instruction, { exact: true })).toBeVisible();
    await expect(root.getByText(/Essential needs/).first()).toBeVisible();
  }
});

test("repeated reader enhancement is stable across every active handbook edition", async ({ page }) => {
  await page.goto("/reader-hardening");
  for (const slug of ["habit", "decision", "money", "identity", "attention"]) {
    for (const edition of ["school", "emerging_adult", "workplace"]) {
      await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`${slug}-${edition}`);
      for (let day = 1; day <= 10; day++) {
      await page.getByRole("combobox", { name: "Day", exact: true }).selectOption(String(day));
      const root = page.locator(`[data-specimen="${slug}-${edition}"][data-day="${day}"]`);
      await expect(root).toBeVisible();
      const issues = await root.evaluate(element => {
        const checks = [...element.querySelectorAll<HTMLElement>("[data-formative-signal-for]")];
        const checkIds = checks.map(check => check.dataset.formativeSignalFor);
        const fields = [...element.querySelectorAll("textarea[data-field-id]")];
        return { duplicateChecks: checks.length - new Set(checkIds).size, excessChecks: checks.length > 4, duplicateResponses: fields.length - new Set(fields.map(field => field.getAttribute("data-field-id"))).size, misplaced: checks.filter(check => [...element.querySelectorAll(`[data-response-check="${check.dataset.formativeSignalFor}"]`)].some(field => !(field.compareDocumentPosition(check) & Node.DOCUMENT_POSITION_FOLLOWING))).length };
      });
      expect(issues, `${slug}-${edition} day ${day}`).toEqual({ duplicateChecks: 0, excessChecks: false, duplicateResponses: 0, misplaced: 0 });
      const fields = await root.locator("[data-field-id]").evaluateAll(elements => elements.map(element => ({ id: element.getAttribute("data-field-id"), key: element.getAttribute("data-source-key"), purpose: element.getAttribute("data-purpose") })).sort((left, right) => left.id!.localeCompare(right.id!)));
      const accepted = responseIdentities.find(row => row.slug === slug && row.edition === edition && row.day === day)!;
      expect(fields.length, `${slug}-${edition} day ${day} response count`).toBe(accepted.count);
      expect(createHash("sha256").update(JSON.stringify(fields)).digest("hex"), `${slug}-${edition} day ${day} accepted response identities`).toBe(accepted.digest);
      }
    }
  }
});

test("session disclosures preserve objectives, Lab timing and heading wording across editions", async ({ page }) => {
  await page.goto("/reader-hardening");
  for (const slug of ["habit", "decision", "money", "identity", "attention"]) {
    for (const edition of ["school", "emerging_adult", "workplace"]) {
      await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`${slug}-${edition}`);
      await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("1");
      const root = page.locator(`[data-specimen="${slug}-${edition}"][data-day="1"]`);
      await expect(root).toBeVisible();
      const details = root.locator(".handbook-session-details");
      await expect(details).toHaveCount(1);
      await expect(details.locator("input,textarea,select,button")).toHaveCount(0);
      await expect(details).toContainText("SESSION:");
      await expect(details).toContainText("MODE:");
      await expect(details).not.toContainText("TODAY YOU WILL");
      await expect(root.locator(".handbook-check-row,.source-list>li").first()).toBeVisible();
      await details.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(details).toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(details).not.toHaveAttribute("open");
      const decoration = root.locator(".handbook-heading-decoration").first();
      await expect(decoration).toBeHidden();
      expect(await decoration.textContent()).toMatch(/📖|💭/u);
      await page.getByRole("combobox", { name: "Day", exact: true }).selectOption("3");
      const bridge = page.locator(`[data-specimen="${slug}-${edition}"][data-day="3"]`);
      await expect(bridge.locator(".handbook-session-details")).toHaveCount(1);
      await expect(bridge.getByText("Lab session details · 90 minutes", { exact: true })).toBeVisible();
      await expect(bridge.locator(".handbook-session-details")).toContainText("90 minutes");
      expect(await bridge.locator(".handbook-check-row").allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining("YOU WILL NEED")]));
    }
  }
});

test("reading preference changes actual handbook text and answer size after navigation and refresh", async ({ page }) => {
  const profile = { profile: { textSizePreference: "standard", readingWidthPreference: "standard" } };
  await page.route("**/api/profile", async route => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      profile.profile.textSizePreference = body.textSize ?? profile.profile.textSizePreference;
    }
    await route.fulfill({ json: profile });
  });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  const preview = page.locator(".reading-preview p");
  const standard = await preview.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  await page.getByRole("combobox", { name: "Text size" }).selectOption("extra_large");
  await expect.poll(() => preview.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeCloseTo(standard * 1.3, 1);
  await page.goto("/reader-hardening");
  const root = page.locator('[data-specimen="money-emerging_adult"][data-day="2"]');
  await expect(root.locator("textarea").first()).toBeVisible();
  for (const selector of ["p", "textarea", ".generated-question-response-row>span"]) {
    expect(await root.locator(selector).first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeCloseTo(20.8, 1);
  }
  await page.reload();
  await expect(root.locator("textarea").first()).toBeVisible();
  expect(await root.locator("p").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeCloseTo(20.8, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("orientation, weekend and certificate render across every accepted handbook edition", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/reader-hardening");
  for (const slug of ["habit", "decision", "money", "identity", "attention"]) {
    for (const edition of ["school", "emerging_adult", "workplace"]) {
      await page.getByRole("combobox", { name: "Handbook", exact: true }).selectOption(`${slug}-${edition}`);
      for (const key of ["Welcome", "Weekend", "Certificate"]) {
        await page.getByRole("combobox", { name: "Day", exact: true }).selectOption(key);
        const root = page.locator(`[data-specimen="${slug}-${edition}"][data-page-key="${key}"]`);
        await expect(root).toBeVisible();
        expect((await root.textContent())!.length).toBeGreaterThan(100);
        const fields = await root.locator("[data-field-id]").evaluateAll(elements => elements.map(element => `${element.getAttribute("data-field-id")}${element instanceof HTMLInputElement && element.type === "radio" ? `:${element.value}` : ""}`));
        expect(new Set(fields).size).toBe(fields.length);
        await expect(root.locator(".handbook-session-details input,.handbook-session-details textarea")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${slug}-${edition} ${key}`).toBeLessThanOrEqual(1);
      }
    }
  }
  expect(errors).toEqual([]);
});
