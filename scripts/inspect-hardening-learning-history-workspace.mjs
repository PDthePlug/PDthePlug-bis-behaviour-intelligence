import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

const output = process.env.BIS_HISTORY_DIR || "/tmp/bis-learning-history-fixed";
const prepared = JSON.parse(await readFile(`${output}/prepared.json`, "utf8"));
const admin = await stagingSession();
await admin.browserState(`${output}/workspace-state.json`);
await mkdir(`${output}/workspace`, { recursive: true });
const axe = await readFile("/tmp/bis-hardening-axe.min.js", "utf8");
const browser = await chromium.launch();
const rows = [];
try {
  for (const edition of ["school", "emerging_adult", "workplace"]) for (const width of [360, 430, 1280]) {
    const context = await browser.newContext({ storageState: `${output}/workspace-state.json`, viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const route = `/content-studio/preview/${encodeURIComponent(prepared.versionId)}?kind=LEARNING_MODULE&code=HAB&edition=${edition}`;
    await page.goto(admin.base + route);
    const frame = page.frameLocator("iframe");
    await expect(frame.locator(".prototype-document")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".uat-preview-editions")).toContainText(edition === "emerging_adult" ? "Emerging Adult" : edition === "school" ? "School" : "Workplace");
    await expect(page.locator(".uat-preview-notice")).toContainText("Nothing you type here is saved to a learner record");
    const title = frame.locator(".learner-document-title");
    const firstTitle = await title.innerText();
    await frame.getByRole("button", { name: "Next preview page", exact: true }).click();
    await expect(title).not.toHaveText(firstTitle);
    await frame.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(title).toHaveText(firstTitle);
    await page.getByRole("button", { name: "Mobile", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".uat-preview-stage")).toHaveClass(/mobile/);
    await page.screenshot({ path: `${output}/workspace/${edition}-${width}-mobile-preview.png` });
    await page.getByRole("button", { name: "Desktop", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".uat-preview-stage")).toHaveClass(/desktop/);
    await page.addScriptTag({ content: axe });
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => item.id));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    rows.push({ route, edition, width, overflow, violations, errors, navigation: "PASS: Next preview page and Previous preserve the return page", deviceControls: "PASS: keyboard Mobile and Desktop", previewBoundary: "Explicit preview-only notice", manualReview: "PENDING; image capture does not certify all content" });
    await writeFile(`${output}/workspace-audit.json`, JSON.stringify(rows, null, 2));
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  }
} finally { await browser.close(); }
assert.equal(rows.length, 9);
assert.ok(rows.every(row => row.overflow <= 1 && !row.violations.length && !row.errors.length));
