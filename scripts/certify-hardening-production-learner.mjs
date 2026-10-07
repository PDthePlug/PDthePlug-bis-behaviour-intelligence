import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { productionSession } from "./hardening-production-session.mjs";
import { availableLabPrompts } from "../lib/lab-interaction-contract.mjs";
import { labSubmissionDefinition } from "../lib/lab-progress-compatibility.mjs";
import { normalizePromptResponseValue } from "../lib/evidence-validation.mjs";

if (process.env.BIS_HARDENING_ALLOW_PRODUCTION_FIXTURE_WRITES !== "true") throw new Error("Explicit isolated-production-fixture write acknowledgement required.");
const session = await productionSession("LEARNER");
const initial = await session.request("/api/profile");
const output = "/tmp/bis-production-takeover-learner";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const checks = [], errors = [];
let result = "FAIL";
try {
  const context = await browser.newContext({ viewport: { width: 360, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
  page.on("response", response => { if (response.status() >= 400) errors.push({ kind: "http", status: response.status(), path: new URL(response.url()).pathname }); });
  await page.goto(session.base + "/sign-in?next=%2Fsettings");
  await page.getByLabel("Email", { exact: true }).fill(session.account.email);
  await page.getByLabel("Password", { exact: true }).fill(session.account.password);
  await page.getByRole("button", { name: /^Enter BIS/ }).click();
  await expect(page).toHaveURL(session.base + "/settings");
  checks.push({ journey: "Fresh password sign-in and protected return", result: "PASS" });
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await page.getByRole("combobox", { name: "Text size" }).selectOption("extra_large");
  await expect(page.locator(".settings-status")).toHaveText("Saved");
  await page.goto(session.base + "/handbooks/hab?page=2");
  const first = page.locator("textarea[data-response-check]").first();
  await expect(first).toBeVisible();
  const fieldId = await first.getAttribute("data-field-id"), checkId = await first.getAttribute("data-response-check");
  const value = "PRIVATE-TAKEOVER-QA-REFLECTION: fictional learning response for the isolated verification cohort, not programme evidence.";
  for (const field of await page.locator(`[data-response-check="${checkId}"]`).all()) await field.fill(value);
  const understanding = page.locator(`[data-formative-signal-for="${checkId}"]`).getByRole("radio", { name: "I understand this", exact: true });
  await understanding.focus(); await page.keyboard.press("Space");
  await expect(understanding).toBeChecked();
  await expect(page.locator(".prototype-save-state")).toContainText("Your saved responses are up to date");
  await page.reload();
  await expect(page.locator(`[data-field-id="${fieldId}"]`)).toHaveValue(value);
  await expect(understanding).toBeChecked();
  const size = await first.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  assert.ok(Math.abs(size - 20.8) < 0.2);
  checks.push({ journey: "Workbook response, understanding check and text-size refresh recovery", result: "PASS", fieldId, textSize: size });
  let state = await session.request("/api/universal-lab?lab=HAB");
  if (!state.enrolment) state = await session.request("/api/universal-lab", { action: "openLab", labCode: "HAB", consent: true });
  for (const stage of [0, 1]) {
    const definition = labSubmissionDefinition(state.definition, state.enrolment, stage, state.progressCompatibility.baselineAccepted);
    const prompts = availableLabPrompts(definition, stage, 0).filter(prompt => !prompt.readOnly);
    const items = prompts.filter(prompt => !state.responses[prompt.id]).map(prompt => ({ semanticFieldId: prompt.id, responseStatus: "ANSWERED", value:
      prompt.type === "INTEGER" ? String(Math.max(prompt.min ?? 0, Math.min(prompt.max ?? 10, 5))) :
        prompt.type === "BOOLEAN" ? "No" : prompt.type === "DATE" ? new Date().toISOString().slice(0, 10) :
          prompt.type === "CATEGORICAL" ? prompt.options[0] : prompt.type === "MULTI_SELECT" ? JSON.stringify([prompt.options[0]]) : value }));
    if (items.length) state = await session.request("/api/universal-lab", { action: "saveInvestigation", labCode: "HAB", investigation: stage, items });
    const refreshed = await session.request("/api/universal-lab?lab=HAB");
    for (const item of items) assert.deepEqual(refreshed.responses[item.semanticFieldId]?.value, normalizePromptResponseValue(prompts.find(prompt => prompt.id === item.semanticFieldId), item.value));
    checks.push({ journey: stage === 0 ? "Source-defined Lab baseline persistence" : "Source-defined Hook capture persistence", result: "PASS", fields: items.map(item => item.semanticFieldId), version: state.version });
  }
  await page.goto(session.base + "/labs/hab?step=1");
  await expect(page.locator(".universal-package-lab")).toBeVisible();
  await page.reload(); await expect(page.locator(".universal-package-lab")).toBeVisible();
  checks.push({ journey: "Lab re-entry after capture", result: "PASS" });
  for (const role of ["FACILITATOR", "SPONSOR_VIEWER"]) {
    const actor = await productionSession(role);
    const snapshot = await actor.request("/api/staff");
    assert.ok(!JSON.stringify(snapshot).includes("PRIVATE-TAKEOVER-QA-REFLECTION"));
    checks.push({ journey: `${role} excludes private QA reflection`, result: "PASS" });
  }
  assert.deepEqual(errors, []);
  result = "PASS";
} finally {
  await browser.close();
  await session.request("/api/profile", { textSize: initial.profile.textSizePreference || "standard" }, "PATCH");
  await writeFile("docs/hardening/production-takeover-learner-journey.json", JSON.stringify({ observedAt: new Date().toISOString(), result, checks, errors, calendarOverride: false, boundary: "Dedicated authorised QA learner only. Baseline and Hook are verified only if their checks pass; calendar-complete investigation and certificate issuance are not claimed." }, null, 2) + "\n");
}
console.log({ checks: checks.length, result: "PASS", calendarOverride: false });
