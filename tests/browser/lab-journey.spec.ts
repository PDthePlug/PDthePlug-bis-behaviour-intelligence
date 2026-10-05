import { expect, test, type Page } from "@playwright/test";
import fixtures from "../fixtures/authored-lab-interactions.json" with { type: "json" };
import type { UniversalLabPackage } from "../../lib/content-compiler";
import { prepareUniversalLabPresentation } from "../../lib/universal-lab-presentation.mjs";
import { upgradeUniversalLabV2 } from "../../lib/universal-lab-v2.mjs";
import { availableLabPrompts, validateLabSubmission } from "../../lib/lab-interaction-contract.mjs";
import { labSubmissionDefinition } from "../../lib/lab-progress-compatibility.mjs";

const definition = prepareUniversalLabPresentation(upgradeUniversalLabV2(fixtures.labs.find(lab => lab.identity.code === "LDR")!)) as UniversalLabPackage;

async function service(page: Page, current = 0) {
  const responses: Record<string, { value: unknown; status: string; recordedAt: string }> = {};
  const enrolment = { id: "browser-specimen", status: "IN_PROGRESS", currentInvestigation: current || 1, phaseACompletedAt: null as string | null, experimentStartedAt: null as string | null, completedAt: null as string | null };
  let opened = current > 0;
  let baselineAccepted = current > 1;
  let day = 1;
  const submissions: Array<{ investigation: number; ids: string[] }> = [];
  function snapshot() {
    return {
      definition, version: "source-specimen", identity: { id: "specimen", displayName: "Browser learner" },
      enrolment: opened ? { ...enrolment, currentInvestigation: day > definition.experiment!.days ? Math.max(8, enrolment.currentInvestigation) : enrolment.currentInvestigation } : null,
      responses, computed: {}, progressCompatibility: { baselineAccepted, completedInvestigations: definition.investigations.filter(stage => stage.number < enrolment.currentInvestigation).map(stage => stage.number) },
      experimentTiming: { availableDay: day, totalDays: definition.experiment!.days, today: "2026-10-03", reviewReady: day >= definition.experiment!.days, startedAt: enrolment.experimentStartedAt },
    };
  }
  await page.route("**/api/universal-lab**", async route => {
    try {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        if (body.action === "openLab") opened = true;
        if (body.action === "saveInvestigation") {
          const stage = Number(body.investigation);
          const saved = validateLabSubmission(labSubmissionDefinition(definition, enrolment, stage, baselineAccepted), stage, day, body.items, responses);
          submissions.push({ investigation: stage, ids: saved.map(item => item.semanticFieldId) });
          for (const item of saved) responses[item.semanticFieldId] = { value: item.value, status: item.responseStatus, recordedAt: new Date().toISOString() };
          if (stage === 0) baselineAccepted = true;
          else if (stage !== 7) enrolment.currentInvestigation = Math.max(enrolment.currentInvestigation, Math.min(9, stage + 1));
          if (stage === 6) enrolment.experimentStartedAt = new Date().toISOString();
        }
        if (body.action === "completeLab") enrolment.status = "COMPLETED";
      }
      await route.fulfill({ json: snapshot() });
    } catch (error) {
      await route.fulfill({ status: 400, json: { error: String(error) } });
    }
  });
  return { submissions, responses, setDay: (value: number) => { day = value; } };
}

async function passAll(page: Page) {
  for (const control of await page.getByRole("checkbox", { name: /Prefer not to answer/ }).all()) {
    if (!(await control.isChecked())) await control.check();
  }
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const menu = page.getByRole("button", { name: /^Open BIS menu/ });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(3);
}

test("Leadership welcome, baseline numeric save and all investigation controls", async ({ page }, info) => {
  const api = await service(page);
  await page.goto("/labs/ldr");
  await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  const card = page.locator(".universal-start-card");
  expect((await card.boundingBox())!.height).toBeLessThan(400);
  await noOverflow(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Open Leadership Lab" }).click();
  await expect(page.getByRole("heading", { name: "Your current behaviours" })).toBeVisible();
  await expect(page.getByText(/^Starting behaviour \d+$/)).toHaveCount(0);
  for (const control of await page.getByRole("combobox").all()) {
    await control.click();
    await page.getByRole("option", { name: "Sometimes", exact: true }).click();
  }
  await page.locator(".control-rating").getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Enter Leadership Lab" }).click();
  await expect(page.locator(".universal-package-lab")).toBeVisible();
  expect(api.responses[definition.presentationBaseline!.metric!.id].value).toBe("5");
  for (let stage = 1; stage <= 6; stage++) {
    await expect(page.locator(".universal-package-lab")).toBeVisible();
    await noOverflow(page);
    if (stage === 4) {
      const fields = definition.investigations[3].prompts.filter(prompt => /^Where I lead [123]$/.test(prompt.label));
      expect(fields).toHaveLength(3);
      for (const field of fields) await expect(page.locator(`[data-prompt-id="${field.id}"]`)).toBeVisible();
      await info.attach("leadership-mapping", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
    await passAll(page);
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect.poll(() => api.submissions.some(item => item.investigation === stage)).toBe(true);
    await expect(page).toHaveURL(new RegExp(`step=${stage + 1}`));
  }
  const today = availableLabPrompts(definition, 7, 1).filter(prompt => !prompt.readOnly);
  for (const prompt of today) await expect(page.locator(`[data-prompt-id="${prompt.id}"]`)).toBeVisible();
  for (const prompt of availableLabPrompts(definition, 7, 2).filter(prompt => !prompt.readOnly)) await expect(page.locator(`[data-prompt-id="${prompt.id}"]`)).toHaveCount(0);
  await passAll(page);
  await page.getByRole("button", { name: "Save today’s evidence", exact: true }).click();
  await expect.poll(() => api.submissions.some(item => item.investigation === 7)).toBe(true);
  await expect(page).toHaveURL(/step=7/);
  await info.attach("day-one-evidence", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  api.setDay(definition.experiment!.days + 1);
  await page.goto("/labs/ldr?step=8");
  await expect(page.locator(".universal-lab-mission-copy > p.eyebrow")).toHaveText("Investigation 8 of 9");
  await passAll(page);
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(page).toHaveURL(/step=9/);
  await passAll(page);
  await page.getByRole("button", { name: "Complete Lab", exact: true }).click();
  await expect(page.getByText("Browser learner, your nine-investigation evidence trail is complete.")).toBeVisible();
});

test("existing learner can revisit a completed stage without invented answers", async ({ page }) => {
  const api = await service(page, 7);
  await page.goto("/labs/ldr?step=4");
  await expect(page.locator(".universal-package-lab")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(page).toHaveURL(/step=5/);
  expect(api.submissions.find(item => item.investigation === 4)!.ids).toHaveLength(0);
  expect(Object.keys(api.responses)).toHaveLength(0);
});

test("shared entry and baseline rating visual regression", async ({ page }) => {
  await service(page);
  await page.goto("/labs/ldr");
  await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await expect(page.locator(".universal-start-card")).toHaveScreenshot("lab-entry.png", { animations: "disabled", maxDiffPixelRatio: 0.02 });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Open Leadership Lab" }).click();
  await expect(page.getByRole("heading", { name: "Your current behaviours" })).toBeVisible();
  await expect(page.locator(".control-rating")).toHaveScreenshot("baseline-rating.png", { animations: "disabled", maxDiffPixelRatio: 0.02 });
});

test("day-one evidence returns to the exact learning location", async ({ page }) => {
  await service(page, 7);
  await page.route("**/learn?**", route => route.fulfill({ contentType: "text/html", body: "<h1>Learning handback</h1>" }));
  await page.goto("/labs/ldr?step=7&returnTo=" + encodeURIComponent("/learn?module=LDR&page=day-3"));
  await expect(page.locator(".universal-daily-entry")).toBeVisible();
  await passAll(page);
  await page.getByRole("button", { name: "Save today’s evidence & return" }).click();
  await expect(page).toHaveURL("/learn?module=LDR&page=day-3");
});

test("a no-opportunity day is recorded distinctly and restores after refresh", async ({ page }) => {
  const api = await service(page, 7);
  await page.goto("/labs/ldr?step=7");
  const action = availableLabPrompts(definition, 7, 1).find(prompt => prompt.type === "BOOLEAN" && prompt.allowNoOpportunity);
  expect(action).toBeTruthy();
  await expect(page.locator(".universal-daily-entry")).toBeVisible();
  await passAll(page);
  const field = page.locator(`[data-prompt-id="${action!.id}"]`);
  await field.getByRole("checkbox", { name: /Prefer not to answer/ }).uncheck();
  await field.getByRole("button", { name: "No opportunity", exact: true }).click();
  await page.getByRole("button", { name: "Save today’s evidence", exact: true }).click();
  await expect.poll(() => api.responses[action!.id]?.value).toBe("No opportunity");
  await page.reload();
  await expect(page.locator(`[data-prompt-id="${action!.id}"]`).getByRole("button", { name: "No opportunity", exact: true })).toHaveAttribute("aria-pressed", "true");
});


test("Lab investigation renders through the shared learner-document surface", async ({ page }, info) => {
  await service(page, 2);
  await page.goto("/labs/ldr?step=1");

  const surface = page.locator(".learner-document");
  await expect(surface).toBeVisible();
  await expect(surface.locator(".learner-document-header")).toBeVisible();
  await expect(surface.locator(".learner-document-title")).toBeVisible();
  await expect(surface.locator(".learner-document-purpose")).toBeVisible();
  await expect(surface.locator(".learner-document-body")).toBeVisible();

  const geometry = await surface.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      background: style.backgroundColor,
      radius: style.borderRadius,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.background).toBe("rgb(255, 255, 255)");
  expect(Number.parseFloat(geometry.radius)).toBe(0);
  await page.screenshot({ path: info.outputPath("workbook-canvas-lab.png"), fullPage: true });
});
