import { test, expect } from "@playwright/test";
import { assertResponsive, fetchJson, observeFailures, signIn } from "./support";

type Catalogue = { items?: Array<{ kind: string; code: string; runtimeMode?: string; version?: string; live?: boolean }> };
type Lab = { version: string; enrolment: null | { currentInvestigation: number }; responses: Record<string, { value: unknown }>; definition: { runtimeProfile?: string } };

test("active catalogue and Universal runtime resolve from staging", async ({ page }, testInfo) => {
  const clean = observeFailures(page);
  await signIn(page, "learner");
  const catalogue = await fetchJson<Catalogue>(page, "/api/runtime-catalogue");
  expect(catalogue.status).toBe(200);
  const code = process.env.BIS_STAGING_LAB_CODE
    || catalogue.body.items?.find((item) => item.kind === "LAB" && item.runtimeMode === "DYNAMIC" && item.live)?.code;
  expect(code, "staging needs an active governed Lab").toBeTruthy();
  const lab = await fetchJson<Lab>(page, `/api/universal-lab?lab=${encodeURIComponent(code!)}`);
  expect(lab.status).toBe(200);
  expect(lab.body.version).toBeTruthy();
  expect(lab.body.definition.runtimeProfile).toMatch(/^UNIVERSAL/);
  await assertResponsive(page, testInfo, `/labs/${encodeURIComponent(code!)}`);
  clean();
});

test("structured ratings do not render redundant number inputs", async ({ page }) => {
  const clean = observeFailures(page);
  await signIn(page, "learner");
  const code = process.env.BIS_STAGING_LAB_CODE;
  test.skip(!code, "Set BIS_STAGING_LAB_CODE to the controlled staging Universal Lab.");
  await page.goto(`/labs/${encodeURIComponent(code!)}`);
  await expect(page.locator(".universal-rating-scale").first()).toBeVisible();
  await expect(page.locator(".universal-rating-scale input[type=number]")).toHaveCount(0);
  clean();
});

test("controlled evidence save persists across refresh", async ({ page }) => {
  const fixtureText = process.env.BIS_STAGING_EVIDENCE_FIXTURE;
  test.skip(process.env.BIS_STAGING_ALLOW_MUTATIONS !== "true" || !fixtureText,
    "Set BIS_STAGING_ALLOW_MUTATIONS=true and BIS_STAGING_EVIDENCE_FIXTURE to controlled JSON.");
  const fixture = JSON.parse(fixtureText!) as { labCode: string; investigation: number; items: Array<{ semanticFieldId: string; value: unknown; responseStatus?: string }> };
  const clean = observeFailures(page);
  await signIn(page, "learner");
  const before = await fetchJson<Lab>(page, `/api/universal-lab?lab=${encodeURIComponent(fixture.labCode)}`);
  if (!before.body.enrolment) {
    expect((await fetchJson(page, "/api/universal-lab", { method: "POST", body: { action: "openLab", labCode: fixture.labCode, consent: true } })).status).toBe(200);
  }
  const saved = await fetchJson<Lab>(page, "/api/universal-lab", { method: "POST", body: { action: "saveInvestigation", labCode: fixture.labCode, investigation: fixture.investigation, items: fixture.items } });
  expect(saved.status).toBe(200);
  await page.goto(`/labs/${encodeURIComponent(fixture.labCode)}`);
  await page.reload();
  const restored = await fetchJson<Lab>(page, `/api/universal-lab?lab=${encodeURIComponent(fixture.labCode)}`);
  for (const item of fixture.items) {
    if (item.responseStatus !== "PASS") expect(String(restored.body.responses[item.semanticFieldId]?.value)).toEqual(String(item.value));
  }
  clean();
});
