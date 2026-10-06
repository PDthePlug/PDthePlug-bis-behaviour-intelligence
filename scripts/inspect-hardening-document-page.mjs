import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

// Capture every screen of one exact page for a manual review, never a publication.
const code = process.env.BIS_REVIEW_CODE || "idn";
const pageNumber = Number(process.env.BIS_REVIEW_PAGE || "12");
if (!/^[a-z]{3}$/.test(code) || !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 13) throw new Error("An exact handbook page is required.");
const output = process.env.BIS_REVIEW_DIR || `/tmp/bis-document-review-${code}-${pageNumber}`;
await mkdir(output, { recursive: true });
const session = await stagingSession("LEARNER", 19);
const { profile } = await session.request("/api/profile");
if (profile?.deliveryEdition !== "emerging_adult") throw new Error("This review expects the dedicated emerging-adult fixture.");
const state = `${output}/state.json`;
await session.browserState(state);
const axe = await readFile("/tmp/bis-hardening-axe.min.js", "utf8");
const browser = await chromium.launch();
const rows = [];
try {
  for (const width of [360, 430, 1280]) {
    const context = await browser.newContext({ storageState: state, viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const route = `/handbooks/${code}?page=${pageNumber}`;
    await page.goto(session.base + route);
    const document = page.locator(".learner-document");
    await expect(document).toBeVisible({ timeout: 60000 });
    await page.waitForLoadState("networkidle");
    const referenceView = await page.locator(".prototype-sequence-notice").count() > 0;
    if (referenceView) {
      await expect(page.locator(".learner-document-status")).toHaveText("Reference view · you can read this page, but cannot add responses yet");
      await expect(document.locator("[data-field-id]:not(:disabled)")).toHaveCount(0);
    }
    const listStyles = await document.locator("ul.source-list,ol.source-list").evaluateAll(elements => elements.map(element => ({ type: element.tagName, style: getComputedStyle(element).listStyleType, items: element.children.length })));
    for (const list of listStyles) expect(list.style).toBe(list.type === "UL" ? "disc" : "decimal");
    const headings = await document.locator("h1,h2,h3,h4,h5,h6").allTextContents();
    const text = await document.innerText();
    await writeFile(`${output}/${width}-reading.txt`, text);
    const screens = [];
    const height = await page.evaluate(() => window.document.documentElement.scrollHeight);
    for (let top = 0, index = 0; top < height; top += 760, index++) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: "instant" }), top);
      const name = `${width}-${String(index).padStart(2, "0")}.png`;
      await page.screenshot({ path: `${output}/${name}` });
      screens.push(name);
    }
    await page.addScriptTag({ content: axe });
    const accessibility = await page.evaluate(async () => (await window.axe.run(window.document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
    const overflow = await page.evaluate(() => window.document.documentElement.scrollWidth - innerWidth);
    rows.push({ route, role: "LEARNER", edition: profile.deliveryEdition, width, headings, screens, height, overflow, accessibility, errors, referenceView, responseStatus: await page.locator(".learner-document-status").innerText(), listStyles, manualReview: "PENDING; image capture is not manual certification" });
    await writeFile(`${output}/audit.json`, JSON.stringify(rows, null, 2));
    console.log(JSON.stringify({ width, screens: screens.length, overflow, accessibility, errors }));
    await context.close();
  }
} finally { await browser.close(); }
if (rows.some(row => row.overflow > 1 || row.accessibility.length || row.errors.length)) process.exitCode = 1;
