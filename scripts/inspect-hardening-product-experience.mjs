import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { stagingSession } from "./hardening-staging-session.mjs";

// Dedicated synthetic staging accounts only; no data mutations or profile edits.
const output = process.env.BIS_HARDENING_PRODUCT_DIR || "/tmp/bis-hardening-product-experience";
const group = JSON.parse(await readFile("/tmp/bis-hardening-group.json", "utf8"));
const axe = await readFile(process.env.BIS_HARDENING_AXE_FILE || "/tmp/bis-hardening-axe.min.js", "utf8");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const rows = [];
try {
  for (const role of ["LEARNER", "FACILITATOR", "SPONSOR_VIEWER"]) {
    const session = await stagingSession(role, role === "LEARNER" ? 19 : 0);
    const storageState = `${output}/${role}-state.json`;
    await session.browserState(storageState);
    for (const width of [360, 430, 1280]) {
      const context = await browser.newContext({ storageState, viewport: { width, height: 900 } });
      const page = await context.newPage();
      let errors = [];
      page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
      page.on("console", message => {
        if (message.type() === "error") errors.push({ kind: "console", message: message.text() });
      });
      page.on("response", response => {
        if (response.status() >= 400) errors.push({ kind: "http", status: response.status(), path: new URL(response.url()).pathname });
      });
      const routes = role === "LEARNER" ? [
        ["decision-day1", "/handbooks/dec?page=2"],
        ["habit-day3", "/handbooks/hab?page=4"],
        ["lab-pattern", "/labs/hab?step=2"],
        ["lab-review", "/labs/hab?step=8"],
        ["money-safety", "/handbooks/mon?page=4"],
        ["identity-day10", "/handbooks/idn?page=12"],
        ["attention-weekend", "/handbooks/att?page=7"],
        ["money-certificate", "/handbooks/mon?page=13"],
        ["attention-orientation", "/handbooks/att?page=1"],
      ] : role === "FACILITATOR"
        ? [["facilitator-group", `/workspace?view=facilitator&group=${encodeURIComponent(group.id)}`]]
        : [["sponsor-learning", `/workspace?view=outcomes&section=learning&group=${encodeURIComponent(group.id)}`]];
      for (const [name, route] of routes) {
        errors = [];
        await page.goto(session.base + route);
        const target = page.locator(role === "LEARNER" ? ".learner-document-body" : role === "FACILITATOR" ? ".facilitator-workspace" : ".programme-outcomes").first();
        await expect(target).toBeVisible({ timeout: 60000 });
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: `${output}/${name}-${width}-top.png` });
        const focus = role === "LEARNER" ? target : page.locator(role === "FACILITATOR" ? ".facilitator-learning-checks" : ".outcomes-learning-checks");
        await expect(focus).toBeVisible();
        await focus.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
        await page.screenshot({ path: `${output}/${name}-${width}-body.png` });
        const details = role === "LEARNER" ? target.locator(".learner-document-disclosure").first()
          : role === "FACILITATOR" ? page.locator(".facilitator-class-disclosure")
            : focus.locator("details").filter({ hasText: "How to read these responses" });
        let keyboardDisclosure = "NOT_APPLICABLE; no secondary disclosure on this page";
        if (await details.count()) {
          await details.locator(":scope > summary").focus();
          await page.keyboard.press("Enter");
          await expect(details).toHaveAttribute("open", "");
          await page.screenshot({ path: `${output}/${name}-${width}-details.png` });
          await page.keyboard.press("Enter");
          await expect(details).not.toHaveAttribute("open");
          keyboardDisclosure = "PASS";
        }
        if (role === "LEARNER" && route.startsWith("/handbooks/")) {
          await expect(target.locator("h1")).toHaveCount(0);
          if (name === "attention-orientation") {
            await details.locator(":scope > summary").focus(); await page.keyboard.press("Enter");
            expect(await details.innerText()).not.toMatch(/Controlled Production Master|Architecture frozen|Production.freeze/);
            await page.keyboard.press("Enter");
          }
        }
        if (role === "LEARNER" && name === "lab-review") {
          const calculations = target.locator(".universal-calculation-context");
          await expect(calculations).toHaveCount(1);
          await calculations.locator(":scope > summary").focus(); await page.keyboard.press("Enter");
          await expect(calculations).toHaveAttribute("open", "");
          await expect(calculations).toContainText("not an assessment of skill");
          await calculations.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
          await page.screenshot({ path: `${output}/${name}-${width}-calculations.png` });
          await page.keyboard.press("Enter"); await expect(calculations).not.toHaveAttribute("open");
        }
        await page.addScriptTag({ content: axe });
        const accessibility = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target) })));
        const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
        const alignment = role === "LEARNER" ? await page.locator(".learner-document").evaluate(element => {
          const gutter = selector => { const node = element.querySelector(selector); return node.getBoundingClientRect().left + parseFloat(getComputedStyle(node).paddingLeft); };
          return Math.abs(gutter(".learner-document-header") - gutter(".learner-document-body"));
        }) : null;
        const row = { name, role, route, width, ...geometry, headerBodyGutterDifference: alignment, accessibility, errors: [...errors], keyboardDisclosure, screenshotPrefix: `${name}-${width}` };
        rows.push(row);
        await writeFile(`${output}/audit.json`, JSON.stringify(rows, null, 2));
        console.log(JSON.stringify(row));
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (rows.some(row => row.overflow > 1 || (row.headerBodyGutterDifference ?? 0) > 1 || row.accessibility.length || row.errors.length)) process.exitCode = 1;
