import { expect, test } from "@playwright/test";

test("profile retry restores assigned staff access without inventing an experience", async ({ page }, info) => {
  let available = false;
  await page.route("**/api/profile", route => route.fulfill(available ? {
    json: { identity: { email: "long.account.address.for.reading-check@fixture.invalid", displayName: "Programme staff" }, roles: ["FACILITATOR"], profile: null },
  } : { status: 503, body: "" }));
  await page.goto("/profile");
  await expect(page.locator(".profile-notice [role=alert]")).toContainText("Your profile details could not be loaded");
  await expect(page.getByText("School", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open programme workspace" })).toHaveCount(0);
  available = true;
  await page.getByRole("button", { name: "Retry", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Programme staff" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open programme workspace" })).toHaveAttribute("href", "/workspace");
  await expect(page.getByText("School", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Programme staff" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.locator(".profile-install > summary").click();
  await info.attach("profile-staff-identity-and-install", { body: await page.screenshot(), contentType: "image/png" });
});

test("accounts without a learner profile receive setup guidance and cannot submit default settings", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/profile", route => {
    if (route.request().method() === "PATCH") writes++;
    return route.fulfill({ json: { profile: null } });
  });
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Set up learner profile" })).toHaveAttribute("href", "/habit");
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeDisabled();
  await page.goto("/experience");
  await expect(page.getByRole("radio", { name: "School", exact: true })).not.toBeChecked();
  for (const radio of await page.getByRole("radio").all()) await expect(radio).toBeDisabled();
  await expect(page.getByRole("link", { name: "Set up learner profile" })).toBeVisible();
  expect(writes).toBe(0);
});

test("workspace entry recovers from an empty response and keeps permission denials closed", async ({ page }) => {
  let mode = "empty";
  const snapshot = { identity: { email: "officer@fixture.invalid", displayName: "Fixture officer" }, roles: ["SAFEGUARDING_OFFICER"], admin: null, facilitator: null, sponsor: null, safeguarding: { cases: [] } };
  await page.route("**/api/staff", route => route.fulfill(mode === "ready" ? { json: snapshot } : { status: mode === "denied" ? 403 : 503, body: "" }));
  await page.goto("/staff-shell?view=facilitator&section=support");
  await expect(page.locator(".staff-gate-error[role=alert]")).toHaveText("We couldn't open the programme workspace. Please try again.");
  await expect(page.getByText(/Unexpected end|JSON input|Failed to fetch/)).toHaveCount(0);
  mode = "ready";
  await page.getByRole("button", { name: "Try again", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "No unresolved cases." })).toBeVisible();
  mode = "denied"; await page.reload();
  await expect(page.locator(".staff-gate-error[role=alert]")).toHaveText("This account does not have access to the programme workspace.");
  await expect(page.locator(".safeguard-case-list")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No unresolved cases." })).toHaveCount(0);
});

test("profile offers only the workspaces attached to each commercial role", async ({ page }) => {
  let role = "";
  await page.route("**/api/profile", route => route.fulfill({ json: { profile: null, roles: [role] } }));
  for (role of ["COMMERCIAL_ADMIN", "COMMERCIAL_LEAD", "COMMERCIAL_RESEARCH", "COMMERCIAL_READ_ONLY"]) {
    await page.goto("/profile");
    await expect(page.getByRole("link", { name: "Open commercial workspace" })).toHaveAttribute("href", "/commercial");
    await expect(page.getByRole("link", { name: "Open programme workspace" })).toHaveCount(0);
  }
  role = "LEARNER"; await page.reload();
  await expect(page.getByRole("link", { name: /Open .*workspace/ })).toHaveCount(0);
});

test("an incomplete evidence response remains unavailable until refreshed", async ({ page }) => {
  let available = false;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/evidence-portfolio", route => route.fulfill({ json: { labs: [] } }));
  await page.route("**/api/evidence-engine?**", route => {
    const view = new URL(route.request().url()).searchParams.get("view");
    const developmentProfile = { profile: { modelVersion: "bis-development-profile:1", reportClassification: {}, status: "LIMITED_EVIDENCE", title: "My BIS", heading: "Your growth", summary: "Your BIS profile will grow as source-backed evidence is recorded.", areas: [], boundary: "This is a living picture of what your recorded programme work supports." } };
    return route.fulfill({ json: view === "timeline" ? available ? { records: [], index: { years: [], labs: [], record_count: 0 } } : { records: [] } : view === "developmentProfile" ? developmentProfile : { groups: [], rubrics: [], submissions: [] } });
  });
  await page.goto("/portfolio");
  await expect(page.locator(".error-banner").filter({ hasText: "Evidence is unavailable. Please try again." })).toBeVisible();
  available = true;
  await page.getByRole("button", { name: "Refresh evidence", exact: true }).click();
  await expect(page.locator(".error-banner")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Profile keyboard focus stays visible and reading chrome stays opaque across themes", async ({ page }) => {
  await page.route("**/api/profile", route => route.fulfill({ json: { profile: null, roles: [] } }));
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  const settings = page.getByRole("link", { name: "Settings", exact: true });
  for (const [appearance, scheme] of [["light", "light"], ["warm", "light"], ["dark", "light"], ["system", "dark"]] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(value => { document.documentElement.dataset.bisAppearance = value; }, appearance);
    await settings.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    await expect(settings).toBeFocused();
    const styles = await settings.evaluate(element => {
      const luminance = (colour: string) => colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      }).reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0);
      const outline = getComputedStyle(element), values = [luminance(outline.outlineColor), luminance(getComputedStyle(element.parentElement!).backgroundColor)].sort((a, b) => b - a);
      return { contrast: (values[0] + .05) / (values[1] + .05), width: parseFloat(outline.outlineWidth), topbar: getComputedStyle(document.querySelector(".canonical-topbar")!).backgroundColor, dock: getComputedStyle(document.querySelector(".canonical-menu-dock")!).backgroundColor };
    });
    expect(styles.contrast).toBeGreaterThanOrEqual(3);
    expect(styles.width).toBeGreaterThanOrEqual(2);
    expect(styles.topbar).toMatch(/^rgb\(/);
    expect(styles.dock).toMatch(/^rgb\(/);
  }
});
