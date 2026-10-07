import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { stagingSession } from "./hardening-staging-session.mjs";

const session = await stagingSession("LEARNER");
if (!/^https:\/\/bis-behaviour-intelligence-[a-z0-9]+\.vercel\.app$/.test(session.base)) throw new Error("An exact verified staging preview is required.");
const output = process.env.BIS_HARDENING_RECOVERY_OUTPUT || "/tmp/bis-takeover-preview-recovery";
await mkdir(output, { recursive: true });
const state = `${output}/state.json`;
await session.browserState(state);
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
let requests = 0;
try {
  const page = await browser.newPage({ storageState: state, viewport: { width: 360, height: 900 } });
  await page.route("**/auth/v1/recover**", route => {
    const request = new URL(route.request().url());
    assert.equal(request.hostname, "lbmhkddrkhtmkcvfmumd.supabase.co");
    const redirect = new URL(request.searchParams.get("redirect_to"));
    assert.equal(redirect.origin, session.base);
    assert.equal(redirect.pathname, "/auth/callback");
    assert.equal(redirect.searchParams.get("next"), "/reset-password");
    requests++;
    // Verify the deployed browser's binding without asking SMTP to deliver to an invalid-domain fixture.
    return route.fulfill({ json: {} });
  });
  await page.goto(session.base + "/forgot-password");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(session.account.email);
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "a reset link has been requested" })).toBeVisible();
  assert.equal(requests, 1);
  assert.equal(new URL(page.url()).origin, session.base);
  const report = { observedAt: new Date().toISOString(), preview: session.base, result: "PASS_RETURN_ORIGIN_ONLY", recoveryReturn: "/auth/callback?next=/reset-password", providerRequest: "Intercepted before provider; no email requested", deliveryVerified: false, recoveryTokenExchangeVerified: false, productionConfigurationChanged: false };
  await writeFile(`${output}/audit.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(report);
} finally { await browser.close(); }
