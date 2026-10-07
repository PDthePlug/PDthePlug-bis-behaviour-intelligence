import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const initialProfile = {
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
  const profile = structuredClone(initialProfile);
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

test("Profile is an identity home and My BIS growth has its own destination", async ({ page }, testInfo) => {
  await profileService(page);
  await page.goto("/profile");

  await expect(page.getByRole("heading", { name: "Browser Learner" })).toBeVisible();
  await mkdir("outputs", { recursive: true });
  await page.screenshot({ path: `outputs/BIS-profile-${testInfo.project.name}.png` });
  await expect(page.getByRole("link", { name: /My experience/ })).toHaveAttribute("href", "/experience");
  await expect(page.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings");
  await expect(page.getByRole("link", { name: /My growth & evidence/ })).toHaveAttribute("href", "/portfolio");
  await expect(page.getByRole("link", { name: /Learning/ })).toHaveAttribute("href", "/learn");

  await expect(page.getByRole("heading", { name: "Your evidence portfolio" })).toHaveCount(0);
  await expect(page.getByText(/evidence anchors/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("Settings persist on re-entry, and My experience is a separate destination", async ({ page }, testInfo) => {
  const patches: Record<string, unknown>[] = [];
  await profileService(page, patches);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeEnabled();
  await mkdir("outputs", { recursive: true });
  await page.screenshot({ path: `outputs/BIS-settings-${testInfo.project.name}.png` });
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("warm");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisAppearance)).toBe("warm");
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Blue", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisAccent)).toBe("blue");
  await expect(page.getByRole("button", { name: "Blue", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await page.getByRole("combobox", { name: "Text size", exact: true }).selectOption("large");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.bisTextSize)).toBe("large");
  await expect(page.getByRole("combobox", { name: "Page width", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "Page width", exact: true }).selectOption("narrow");
  await expect(page.getByRole("combobox", { name: "Page width", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("warm");
  await page.getByRole("button", { name: "Reading", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Text size", exact: true })).toHaveValue("large");
  await expect(page.getByRole("combobox", { name: "Page width", exact: true })).toHaveValue("narrow");
  await expectNoHorizontalOverflow(page);
  await page.goto("/profile");
  await page.getByRole("link", { name: /My experience/ }).click();
  await expect(page).toHaveURL(/\/experience$/);
  await expect(page.getByRole("heading", { name: "My experience", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Workplace", exact: true }).check();
  await expect(page.getByRole("radio", { name: "Workplace", exact: true })).toBeEnabled();
  await expect(page.getByRole("radio", { name: "Workplace", exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Workplace", exact: true })).toBeChecked();
  await expect(patches).toEqual([{ appearance: "warm" }, { accent: "blue" }, { textSize: "large" }, { readingWidth: "narrow" }, { deliveryEdition: "workplace" }]);
  await expectNoHorizontalOverflow(page);
});

test("empty settings responses offer recovery and failed saves restore the saved theme", async ({ page }) => {
  let available = false;
  await page.route("**/api/profile", async route => {
    if (!available || route.request().method() === "PATCH") await route.fulfill({ status: 503, body: "" });
    else await route.fulfill({ json: initialProfile });
  });
  await page.goto("/settings");
  await expect(page.locator(".settings-status [role=alert]")).toHaveText("Settings could not be loaded.");
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeDisabled();
  available = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeEnabled();
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("dark");
  await expect(page.locator(".settings-status [role=alert]")).toHaveText("That setting could not be saved. Try again.");
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("system");
  await expect(page.getByText(/Unexpected end|JSON input/)).toHaveCount(0);
  await page.goto("/experience");
  await expect(page.getByRole("radio", { name: "Workplace", exact: true })).toBeEnabled();
  const attemptedSave = page.waitForRequest(request => request.url().endsWith("/api/profile") && request.method() === "PATCH");
  await page.getByRole("radio", { name: "Workplace", exact: true }).click();
  expect((await attemptedSave).postDataJSON()).toEqual({ deliveryEdition: "workplace" });
  await expect(page.locator(".settings-status [role=alert]")).toHaveText("That setting could not be saved. Try again.");
  await expect(page.getByRole("radio", { name: "School", exact: true })).toBeChecked();
});

test("My BIS opens with growth first and keeps Lab evidence collapsed until requested", async ({ page }, testInfo) => {
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
        : view === "developmentProfile"
          ? { profile: {
              modelVersion: "bis-development-profile:1",
              reportClassification: {},
              status: "AVAILABLE",
              title: "My BIS",
              heading: "Your growth",
              summary: "Your BIS profile currently has evidence across 1 development area.",
              areas: [{
                competencyId: "AC-C04",
                title: "Behaviour change and self-management",
                stageCode: "APPLY",
                stageLabel: "Applies",
                evidenceCount: 1,
                sourceLabs: ["HAB"],
                externalFrameworkAreas: ["Adaptability", "Accountability"],
                summary: "Your recorded work shows that you have used this competency in a real situation.",
                growth: "This is the highest level currently supported by your recorded work in defined BIS tasks.",
                nextStep: "Test the plan, compare what happened with what you expected, and make one evidence-based adjustment.",
                reportable: true,
              }],
              boundary: "This is a living picture of what your recorded programme work supports. It is not a personality label.",
            } }
          : { groups: [], rubrics: [], submissions: [{ id: "submission", user_id: "learner", cohort_id: "group", title: "My transfer evidence", created_at: evidence.occurred_at, revoked_at: null, current: true, evidence: [evidence], reviews: [{ id: "review", created_at: evidence.occurred_at, disposition: "REVIEWED", feedback: "You changed the cue; test it in another situation.", criterion_scores: [] }] }] },
    });
  });

  await page.route("**/api/evidence-portfolio", async route => route.fulfill({ json: { labs: [{ enrolmentId: "enrolment", labCode: "HAB", labVersion: "4.5.2", title: "Habit Lab", status: "COMPLETED", startedAt: "2026-10-01T10:00:00Z", completedAt: "2026-10-05T10:00:00Z", anchors: [{ id: "EXPERIMENT", label: "Real-world test", status: "RECORDED", lastRecordedAt: "2026-10-05T10:00:00Z" }], metrics: [{ code: "HAB.BEI06", label: "Observed adherence", value: "71%", provenanceStatus: "VERIFIED" }], intelligence: { nextAction: { label: "Revisit your evidence and transfer plan" } } }] } }));
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Your growth, evidence and feedback", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your growth", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Behaviour change and self-management", exact: true })).toBeVisible();
  await expect(page.getByText("Applies", { exact: true })).toBeVisible();
  await expect(page.getByText("Habit Lab", { exact: true })).toBeVisible();
  await expect(page.getByText("I changed the cue before the routine started.")).toBeHidden();
  await mkdir("outputs", { recursive: true });
  await page.screenshot({ path: `outputs/BIS-portfolio-${testInfo.project.name}.png` });

  await page.locator(".portfolio-lab-group > summary").click();
  await expect(page.getByText("Observed adherence", { exact: true })).toBeHidden();
  await expect(page.getByText(/You used your planned response in 71%/)).toBeVisible();
  await expect(page.getByText("Behaviour design", { exact: true })).toBeVisible();
  await page.locator(".portfolio-measures > summary").click();
  await expect(page.getByText("Observed adherence", { exact: true })).toBeVisible();
  await expect(page.getByText("71%", { exact: true })).toBeVisible();
  await expect(page.locator(".portfolio-feedback > p")).toHaveText("You changed the cue; test it in another situation.");
  await expect(page.getByText("I changed the cue before the routine started.")).toBeHidden();
  await page.locator(".portfolio-responses > summary").click();
  await expect(page.getByText("I changed the cue before the routine started.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select evidence: My transfer evidence" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
