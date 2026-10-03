import { test, expect } from "@playwright/test";
import { assertResponsive, fetchJson, observeFailures, signIn } from "./support";

test("learner signs in, is role-routed, and cannot access Content Studio", async ({ page }) => {
  const clean = observeFailures(page, [403]);
  await signIn(page, "learner");
  await page.goto("/");
  await expect(page).toHaveURL(/\/(habit|learn|learning)(?:[/?]|$)/);
  const denied = await fetchJson<{ error?: string }>(page, "/api/content-studio");
  expect(denied.status).toBe(403);
  expect(denied.body.error).not.toMatch(/postgres|supabase|sql|relation|policy/i);
  await page.goto("/content-studio");
  await expect(page.getByText(/Content Studio unavailable|do not have access/i)).toBeVisible();
  clean();
});

test("administrator signs in and opens the real Content Studio catalogue", async ({ page }) => {
  const clean = observeFailures(page);
  await signIn(page, "admin");
  await page.goto("/content-studio");
  await expect(page.getByRole("heading", { name: /Choose a BIS title/i })).toBeVisible();
  const studio = await fetchJson<{ items?: Array<{ id: string; code: string; versions: unknown[] }> }>(page, "/api/content-studio");
  expect(studio.status).toBe(200);
  expect(studio.body.items?.length).toBeGreaterThan(0);
  expect(studio.body.items?.some((item) => item.id && item.code && Array.isArray(item.versions))).toBe(true);
  clean();
});

test("learner surfaces are usable at certification viewports", async ({ page }, testInfo) => {
  const clean = observeFailures(page);
  await signIn(page, "learner");
  await assertResponsive(page, testInfo, "/learn");
  clean();
});
