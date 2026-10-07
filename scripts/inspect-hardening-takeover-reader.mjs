import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";
import { productionSession } from "./hardening-production-session.mjs";

const production = process.env.BIS_HARDENING_READER_TARGET === "production";
const output = process.env.BIS_HARDENING_READER_OUTPUT || "/tmp/bis-takeover-reader-final";
await mkdir(output, { recursive: true });
const axe = await readFile("/tmp/bis-hardening-axe.min.js", "utf8");
const browser = await chromium.launch({ proxy: production && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const rows = [];
try {
  const session = production ? await productionSession("LEARNER") : await stagingSession("LEARNER");
  const state = `${output}/state.json`;
  await session.browserState(state);
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  let errors = [];
  page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
  page.on("console", message => { if (message.type() === "error") errors.push({ kind: "console", message: message.text() }); });
  page.on("response", response => { if (response.status() >= 400) errors.push({ kind: "http", status: response.status(), path: new URL(response.url()).pathname }); });
  for (const width of [360, 430, 1280]) for (const position of [4, 13]) {
    errors = [];
    await page.setViewportSize({ width, height: 900 });
    const route = `/handbooks/hab?page=${position}`;
    await page.goto(session.base + route);
    await expect(page.locator(".prototype-document")).toBeVisible({ timeout: 60000 });
    await page.waitForLoadState("networkidle");
    const tables = [];
    if (position === 4) {
      for (const region of await page.locator(".prototype-document .handbook-table-frame .handbook-table-scroll").all()) {
        const clipped = await region.evaluate(element => element.scrollWidth > element.clientWidth + 1);
        const cue = region.locator("..").locator(":scope > .handbook-table-cue");
        if (clipped) {
          await expect(cue).toBeVisible();
          await region.focus(); await page.keyboard.press("ArrowRight");
          await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
          await region.evaluate(element => { element.scrollLeft = 0; });
        } else await expect(cue).toBeHidden();
        const name = await region.getAttribute("aria-label");
        assert.ok(!/PartWhat|📖|💭|✍/u.test(name));
        tables.push({ name, clipped, keyboardScroll: clipped ? "PASS" : "NOT_NEEDED" });
      }
      await page.locator(".handbook-table-frame").first().evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
    } else {
      const note = page.getByRole("note", { name: "Certificate template" });
      await expect(note).toBeVisible();
      await note.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
      await expect(note).toContainText("does not award a certificate");
    }
    const screenshot = `${position}-${width}.png`;
    await page.screenshot({ path: `${output}/${screenshot}` });
    await page.addScriptTag({ content: axe });
    const accessibility = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await page.reload(); await page.waitForLoadState("networkidle");
    if (position === 13) await expect(page.getByRole("note", { name: "Certificate template" })).toBeVisible();
    const row = { route, role: "LEARNER", target: production ? "production" : "staging", width, tables, accessibility, overflow, errors: [...errors], refresh: "PASS", screenshot, manualReview: "PENDING; capture is separate from visual review" };
    rows.push(row); await writeFile(`${output}/audit.json`, JSON.stringify(rows, null, 2) + "\n");
    console.log({ route, width, tables: tables.length, accessibility: accessibility.length, errors: errors.length, overflow });
  }
} finally { await browser.close(); }
if (rows.some(row => row.overflow > 1 || row.accessibility.length || row.errors.length)) process.exitCode = 1;
