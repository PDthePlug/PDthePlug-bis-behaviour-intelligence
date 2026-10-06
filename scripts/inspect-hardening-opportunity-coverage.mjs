import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

// Read-only inspection using dedicated staging fixtures; never production credentials.
const output = process.env.BIS_HARDENING_OPPORTUNITY_DIR || "/tmp/bis-opportunity-coverage";
const group = JSON.parse(await readFile("/tmp/bis-hardening-group.json", "utf8"));
const axe = await readFile("/tmp/bis-hardening-axe.min.js", "utf8");
await mkdir(output, { recursive: true });
const rows = [];
const browser = await chromium.launch();
try {
  for (const role of ["FACILITATOR", "SYSTEM_ADMIN"]) {
    const session = await stagingSession(role);
    const snapshot = await session.request("/api/staff");
    const learners = role === "FACILITATOR" ? snapshot.facilitator.learners.filter(row => row.cohortId === group.id) : snapshot.admin.learners;
    const counts = learners.flatMap(row => {
      const count = row.experiment?.opportunityCount;
      return typeof count === "number" && Number.isInteger(count) && count >= 0 ? [count] : [];
    });
    const storageState = `${output}/${role}-state.json`;
    await session.browserState(storageState);
    for (const width of [360, 430, 1280]) {
      const context = await browser.newContext({ storageState, viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
      const route = role === "FACILITATOR" ? `/workspace?view=facilitator&group=${group.id}` : "/workspace?view=admin&section=overview";
      await page.goto(session.base + route);
      const section = page.locator(".ops-section").filter({ has: page.getByRole("heading", { name: role === "FACILITATOR" ? "Opportunities recorded" : "Real-world opportunities", exact: true }) });
      await expect(section).toBeVisible({ timeout: 60000 });
      await page.waitForLoadState("networkidle");
      if (counts.length) {
        await expect(section).toContainText(`Recorded opportunity counts are available for ${counts.length} of ${learners.length} learners.`);
        await expect(section.locator(".opportunity-bands strong")).toHaveText([0, 1, 2, 3].map(band => String(counts.filter(count => band === 3 ? count >= 3 : count === band).length)));
        await section.locator("summary").focus(); await page.keyboard.press("Enter");
        await expect(section.getByText(/Zero means no opportunity is recorded/)).toBeVisible();
      } else {
        await expect(section).toContainText(learners.length ? "Opportunity counts are not available" : "No learners are included");
        await expect(section.locator(".opportunity-bands")).toHaveCount(0);
      }
      await section.evaluate(node => node.scrollIntoView({ block: "start", behavior: "instant" }));
      await page.screenshot({ path: `${output}/${role}-${width}.png` });
      await page.addScriptTag({ content: axe });
      const accessibility = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await page.reload(); await page.waitForLoadState("networkidle"); await expect(section).toBeVisible();
      const row = { role, route, width, learners: learners.length, availableCounts: counts.length, unavailableCounts: learners.length - counts.length, overflow, accessibility, errors, refresh: "PASS" };
      rows.push(row); await writeFile(`${output}/audit.json`, JSON.stringify(rows, null, 2));
      console.log(JSON.stringify(row));
      await context.close();
    }
  }
} finally { await browser.close(); }
if (rows.length !== 6 || rows.some(row => row.overflow > 1 || row.accessibility.length || row.errors.length)) process.exitCode = 1;
