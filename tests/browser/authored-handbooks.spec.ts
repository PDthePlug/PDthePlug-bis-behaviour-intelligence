import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadContentTools } from "../../scripts/lib/load-content-tools.mjs";
import { loadPreparedLearningSource } from "../../lib/prepared-learning-source.mjs";

const manifest = JSON.parse(await readFile("content/learning-prepared/handbooks-20261024/manifest.json", "utf8"));
const tools = await loadContentTools();
test.afterAll(() => tools.dispose());

for (const code of ["HAB", "DEC", "LDR", "CAR", "LCH", "FAI"]) {
  for (const edition of ["school", "emerging_adult", "workplace"]) {
    if (!manifest.editions.some((entry: { code: string; edition: string }) => entry.code === code && entry.edition === edition)) continue;
    test(`${code}/${edition}: authored replacement navigates, saves and restores in the shared player`, async ({ page }, info) => {
      const saved = await loadPreparedLearningSource(code, edition);
      const programme = JSON.parse((await tools.compileLearningEdition(saved.bytes, code, saved.sourceVersion, edition)).content);
      const responses: Record<string, unknown> = {};
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.route("**/api/**", async route => {
        const url = new URL(route.request().url());
        // This journey verifies handbook delivery independently of Lab publication.
        if (url.pathname === "/api/lab-runtime") return route.fulfill({ json: { runtimeMode: null, roles: [] } });
        if (url.pathname === "/api/runtime-content") return route.fulfill({ json: { payload: programme } });
        if (url.pathname === "/api/learning") {
          if (route.request().method() === "POST") {
            const body = route.request().postDataJSON();
            if (body.action === "saveWorkbookResponses") for (const item of body.items) responses[item.semanticFieldId] = { ...item, updatedAt: new Date().toISOString() };
          }
          return route.fulfill({ json: { profile: { displayName: "Synthetic learner", deliveryEdition: edition, language: "en", timezone: "Africa/Johannesburg" },
            releases: [{ id: `replacement:${code}:${edition}`, labCode: code, contentVersion: saved.sourceVersion, status: "PUBLISHED" }],
            progress: [{ labCode: code, contentReleaseId: "old-handbook-release", semanticStepId: `${code}.PROGRAMME.DAY10`, status: "COMPLETED", lastSeenAt: new Date().toISOString() }], workbookResponses: responses } });
        }
        return route.fulfill({ json: { roles: [], enrolment: null, responses: {}, measurements: {}, runtimeMode: "STATIC" } });
      });
      await page.goto(`/authored-handbooks?code=${code}`);
      await expect(page).toHaveURL(/page=1/);
      const rating = page.locator('table.handbook-response-table select[data-field-id]').first();
      await expect(rating.locator("option")).toHaveText(["Choose…", "Never", "Rarely", "Sometimes", "Often", "Always"]);
      await rating.selectOption("Often");
      await expect.poll(() => Object.keys(responses).length).toBeGreaterThan(0);
      await page.reload();
      await expect(rating).toHaveValue("Often");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`${code}-${edition}-baseline.png`), fullPage: true });
      await page.getByRole("button", { name: "Complete & continue", exact: true }).click();
      await expect(page).toHaveURL(/page=2/);
      const answer = page.locator('.prototype-document :is(textarea,input[type="text"])[data-field-id]').first();
      await expect(answer).toBeVisible();
      const fieldId = await answer.getAttribute("data-field-id");
      await answer.fill("A synthetic observation tied to the original authored question.");
      await expect.poll(() => Object.keys(responses).length).toBeGreaterThan(0);
      await page.reload();
      await expect(page.locator(`[data-field-id="${fieldId}"]`)).toHaveValue("A synthetic observation tied to the original authored question.");
      await page.getByRole("button", { name: "Complete & continue", exact: true }).click();
      await expect(page).toHaveURL(/page=3/);
      await page.goBack();
      await expect(page).toHaveURL(/page=2/);
      if (["CAR", "LCH"].includes(code)) {
        await page.goto(`/authored-handbooks?code=${code}&page=12`);
        await expect(page.getByText(/Continue the experiment until you have completed 30 calendar days/)).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath(`${code}-${edition}.png`), fullPage: true });
    });
  }
}
