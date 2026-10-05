import { expect, test, type Page } from "@playwright/test";

const profile = {
  identity: { email: "browser.learner@example.test", displayName: "Browser Learner" },
  roles: [],
  profile: {
    displayName: "Browser Learner",
    ageBand: "18-21",
    mode: "FACILITATED",
    deliveryEdition: "school",
    appearancePreference: "system",
    accentPreference: "bis",
    textSizePreference: "standard",
    readingWidthPreference: "standard",
  },
};

async function profileService(page: Page, patches: Record<string, unknown>[] = []) {
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      patches.push(body);
      Object.assign(profile.profile, {
        ...(body.deliveryEdition ? { deliveryEdition: body.deliveryEdition } : {}),
        ...(body.appearance ? { appearancePreference: body.appearance } : {}),
        ...(body.accent ? { accentPreference: body.accent } : {}),
        ...(body.textSize ? { textSizePreference: body.textSize } : {}),
        ...(body.readingWidth ? { readingWidthPreference: body.readingWidth } : {}),
      });
    }
    await route.fulfill({ json: profile });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test("Profile is an identity home and Evidence Portfolio has its own destination", async ({ page }) => {
  await profileService(page);
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "Browser Learner" })).toBeVisible();
  await expect(page.getByRole("link", { name: /My experience/ })).toHaveAttribute("href", "/settings#experience");
  await expect(page.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");
  await expect(page.getByRole("link", { name: /Evidence Portfolio/ })).toHaveAttribute("href", "/portfolio");
  await expect(page.getByRole("link", { name: /Learning/ })).toHaveAttribute("href", "/learn");

  await expect(page.getByRole("heading", { name: "Your evidence portfolio" })).toHaveCount(0);
  await expect(page.getByText(/evidence anchors/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("Settings changes appearance, reading comfort and life context without touching evidence", async ({ page }) => {
  const patches: Record<string, unknown>[] = [];
  await profileService(page, patches);
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Make BIS comfortable to use." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose the context that fits your life now" })).toBeVisible();

  await page.getByRole("button", { name: /Warm/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisAppearance)).toBe("warm");

  await page.getByRole("button", { name: /^Blue/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisAccent)).toBe("blue");

  await page.getByRole("button", { name: /Large Easier reading/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisTextSize)).toBe("large");

  await page.getByRole("button", { name: /Narrow Shorter lines/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisReadingWidth)).toBe("narrow");

  await page.getByRole("button", { name: /Workplace Professional behaviour/ }).click();
  await expect(page.getByText(/Current experience:/)).toContainText("Workplace");
  await expect(page.getByText(/Changing context does not delete, rewrite or reclassify evidence/)).toBeVisible();

  await expect.poll(() => patches).toEqual(expect.arrayContaining([
    { appearance: "warm" },
    { accent: "blue" },
    { textSize: "large" },
    { readingWidth: "narrow" },
    { deliveryEdition: "workplace" },
  ]));
  await expectNoHorizontalOverflow(page);
});

test("Evidence Portfolio opens with Lab history collapsed and expands only on request", async ({ page }) => {
  await profileService(page);
  const evidence = {
    id: "evidence",
    lab_code: "HAB",
    lab_version: "4.5.2",
    enrolment_id: "enrolment",
    investigation_id: "HAB.I9",
    semantic_field_id: "HAB.TRANSFER",
    source_object_type: "RESPONSE",
    source_object_id: "response",
    provenance: "SR",
    value_type: "TEXT",
    value: '"I changed the cue before the routine started."',
    status: "ACTIVE",
    sensitivity: "P2",
    occurred_at: "2026-10-05T10:00:00Z",
    recorded_at: "2026-10-05T10:00:00Z",
    prompt_label: "My transfer evidence",
    evidence_class: "TRANSFER",
    portfolio_purpose: "Track transfer",
    outcome: "Apply behaviour design",
    competency: "Behaviour design",
  };

  await page.route("**/api/evidence-engine?**", async (route) => {
    const view = new URL(route.request().url()).searchParams.get("view");
    await route.fulfill({
      json: view === "timeline"
        ? { records: [evidence], index: { years: [2026], labs: ["HAB"], record_count: 1 } }
        : { groups: [], rubrics: [], submissions: [] },
    });
  });

  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Evidence Portfolio", exact: true })).toBeVisible();
  await expect(page.getByText("Habit Lab", { exact: true })).toBeVisible();
  await expect(page.getByText("I changed the cue before the routine started.")).toBeHidden();

  await page.locator(".portfolio-lab-group summary").click();
  await expect(page.getByText("I changed the cue before the routine started.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select evidence: My transfer evidence" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
