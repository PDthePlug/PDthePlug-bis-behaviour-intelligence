import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

// Dedicated staging fixtures only. No writes, private answer capture or production credentials.
const output = process.env.BIS_HARDENING_FACILITATOR_DIR || "/tmp/bis-facilitator-records";
const group = JSON.parse(await readFile("/tmp/bis-hardening-group.json", "utf8"));
const learnerSession = await stagingSession("LEARNER", 19);
const { data, error } = await learnerSession.client.auth.getUser();
if (error || !data.user) throw new Error("Dedicated learner identity unavailable.");
const session = await stagingSession("FACILITATOR");
const route = `/workspace?view=facilitator&section=participants&group=${encodeURIComponent(group.id)}&learner=${encodeURIComponent(data.user.id)}`;
const axe = await readFile("/tmp/bis-hardening-axe.min.js", "utf8");
await mkdir(output, { recursive: true });
const storageState = `${output}/state.json`;
await session.browserState(storageState);
const browser = await chromium.launch();
const rows = [];
try {
  for (const width of [360, 430, 1280]) {
    const context = await browser.newContext({ storageState, viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
    page.on("console", message => { if (message.type() === "error") errors.push({ kind: "console", message: message.text() }); });
    page.on("response", response => { if (response.status() >= 400) errors.push({ kind: "http", status: response.status(), path: new URL(response.url()).pathname }); });
    await page.goto(session.base + route);
    const activity = page.locator(".ops-section").filter({ has: page.getByRole("heading", { name: "What the programme record shows", exact: true }) });
    await expect(activity).toBeVisible({ timeout: 60000 });
    await expect(activity).toContainText("Recorded activity");
    await expect(activity).toContainText("It does not establish evidence quality, ability or behaviour change.");
    await expect(page.getByText("Repeated real-world testing", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Completed the learning cycle", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Move from planning to the first real-world test", { exact: true })).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await activity.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    await page.screenshot({ path: `${output}/${width}-activity.png` });
    await page.addScriptTag({ content: axe });
    const accessibility = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target) })));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.reload(); await page.waitForLoadState("networkidle");
    await expect(activity).toBeVisible(); await expect(activity).toContainText("Recorded activity");
    const row = { role: "FACILITATOR", route, fixture: "Dedicated emerging-adult learner; synthetic cohort", width, overflow, accessibility, errors, refresh: "PASS", manualReview: "PENDING; capture is not visual certification" };
    rows.push(row); console.log(JSON.stringify(row));
    await writeFile(`${output}/audit.json`, JSON.stringify(rows, null, 2) + "\n");
    await context.close();
  }
} finally { await browser.close(); }
if (rows.some(row => row.overflow > 1 || row.accessibility.length || row.errors.length)) process.exitCode = 1;
