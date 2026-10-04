import { expect, test } from "@playwright/test";
import type { EvidencePortfolioLab } from "../../lib/evidence-portfolio.mjs";
import { assertResponsive, fetchJson, observeFailures, signIn } from "./support";

test("prepared learner portfolio restores evidence guidance and opens the existing Lab", async ({ page }, testInfo) => {
  const clean = observeFailures(page);
  await signIn(page, "learner");
  const result = await fetchJson<{ labs: EvidencePortfolioLab[]; privacy: { originalResponsesIncluded: boolean } }>(page, "/api/evidence-portfolio");
  expect(result.status).toBe(200);
  expect(result.body.privacy.originalResponsesIncluded).toBe(false);
  const lab = result.body.labs.find(item => item.labCode === "HAB");
  expect(lab, "This test requires a prepared staging learner").toBeTruthy();
  expect(lab!.anchors[0].evidenceCount).toBeGreaterThan(0);
  expect(lab!.intelligence.classificationStatus).toBe("UNCLASSIFIED");
  expect(lab!.intelligence.confidence).toBeNull();
  await assertResponsive(page, testInfo, "/profile#evidence-portfolio");
  await expect(page.getByText(lab!.intelligence.summary, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(lab!.intelligence.summary, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: lab!.intelligence.nextAction.label, exact: true }).click();
  await expect(page).toHaveURL(/habit-lab|labs\/HAB/i);
  clean();
});
