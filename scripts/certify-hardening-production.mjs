import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { productionSession } from "./hardening-production-session.mjs";

// Use only the user-authorised QA cohort. Capture no original learner/staff data.
const group = JSON.parse(await readFile("/tmp/bis-production-takeover-group.json", "utf8"));
if (!group.name.startsWith("BIS verification only 20261007")) throw new Error("The isolated QA cohort is required.");
const output = process.env.BIS_PRODUCTION_HARDENING_OUTPUT || "/tmp/bis-production-takeover-live";
const baseline = process.env.BIS_PRODUCTION_HARDENING_PHASE === "baseline";
const axe = await readFile("/tmp/bis-hardening-axe.min.js", "utf8");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const rows = [];
const roleRoutes = {
  LEARNER: ["/habit", "/learn", "/handbooks/hab?page=4", "/handbooks/hab?page=13", "/labs/hab", "/portfolio", "/settings", "/profile"],
  FACILITATOR: ["cohort", "participants", "review"].map(section => `/workspace?view=facilitator&section=${section}&group=${group.id}`),
  SPONSOR_VIEWER: ["overview", "learning", "evidence", "reports"].map(section => `/workspace?view=outcomes&section=${section}&group=${group.id}`),
  PROGRAMME_OWNER: [`/workspace?view=outcomes&section=decisions&group=${group.id}`],
  SYSTEM_ADMIN: ["/workspace?view=admin&section=overview", "/content-studio"],
  SAFEGUARDING_OFFICER: ["/workspace?view=facilitator&section=support"],
};
try {
  for (const [role, routes] of Object.entries(roleRoutes)) {
    const session = await productionSession(role);
    const storageState = `${output}/${role}-state.json`;
    await session.browserState(storageState);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    let failures = [], cancelledPrefetches = [];
    page.on("pageerror", error => failures.push({ kind: "pageerror", message: error.message }));
    page.on("console", message => {
      if (message.type() === "error") failures.push({ kind: "console", message: message.text() });
    });
    page.on("requestfailed", request => {
      const path = new URL(request.url()).pathname, error = request.failure()?.errorText;
      const event = { kind: "requestfailed", path, error };
      if (error === "net::ERR_ABORTED" && request.method() === "GET" && !path.startsWith("/api/") && request.headers()["next-router-prefetch"] === "1") {
        cancelledPrefetches.push({ ...event, disposition: "Expected cancelled Next.js speculative prefetch; explicit request-header proof" });
      } else failures.push(event);
    });
    page.on("response", response => {
      if (response.status() >= 400) failures.push({ kind: "http", status: response.status(), path: new URL(response.url()).pathname });
    });
    for (const width of [360, 430, 1280]) for (const route of routes) {
      failures = [];
      cancelledPrefetches = [];
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(session.base + route);
      await page.waitForLoadState("networkidle");
      if (role === "SYSTEM_ADMIN" && route.startsWith("/workspace")) {
        await page.getByLabel("Find a learner").fill("takeover-20261007-");
      }
      if (!baseline && role === "LEARNER" && route.includes("page=13")) {
        await expect(page.getByRole("note", { name: "Certificate template" })).toBeVisible();
      }
      const trigger = page.getByRole("button", { name: /Open BIS menu/ });
      let menu = "NOT_APPLICABLE";
      if (await trigger.count()) {
        await trigger.focus(); await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
        menu = "PASS";
      }
      const details = page.locator(".programme-publication-details").first();
      let disclosure = "NOT_APPLICABLE";
      if (await details.count()) {
        await details.locator("summary").focus(); await page.keyboard.press("Enter");
        await expect(details).toHaveAttribute("open", "");
        await page.keyboard.press("Enter"); await expect(details).not.toHaveAttribute("open");
        disclosure = "PASS";
      }
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      const screenshot = `${role}-${rows.length}-${width}.png`;
      // Global operator/safeguarding surfaces can contain real records. Their
      // chrome is captured alone; API scope and keyboard behaviour are separate checks.
      if (["SYSTEM_ADMIN", "SAFEGUARDING_OFFICER"].includes(role) && route.startsWith("/workspace")) {
        await page.locator(".staff-workspace-header").screenshot({ path: `${output}/${screenshot}` });
      } else await page.screenshot({ path: `${output}/${screenshot}` });
      await page.reload(); await page.waitForLoadState("networkidle");
      const row = { role, route, width, phase: baseline ? "PRE_RELEASE_BASELINE; does not verify branch-only corrections" : "POST_RELEASE", status: response.status(), overflow, violations, failures: [...failures], cancelledPrefetches: [...cancelledPrefetches], menu, disclosure, refresh: "PASS", screenshot,
        manualReview: "PENDING; automated checks and capture do not establish whole-page visual review" };
      rows.push(row);
      await writeFile(`${output}/audit.json`, JSON.stringify(rows, null, 2) + "\n");
      console.log({ role, route, width, violations: violations.length, failures: failures.length, overflow });
    }
    if (role === "SPONSOR_VIEWER") {
      const pdf = await session.response(`/api/staff?report=pdf&cohortId=${group.id}`);
      assert.equal(pdf.status, 200); assert.match(pdf.headers.get("cache-control"), /private/);
      const bytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
      await writeFile(`${output}/synthetic-programme-report.pdf`, bytes);
      const csv = await session.response(`/api/evidence-engine?view=report&cohortId=${group.id}&download=csv`);
      assert.equal(csv.status, 200);
      await writeFile(`${output}/synthetic-assessment-report.csv`, await csv.text());
    }
    await context.close();
  }
} finally { await browser.close(); }
if (rows.some(row => row.overflow > 1 || row.violations.length || row.failures.length || row.status >= 400)) process.exitCode = 1;
