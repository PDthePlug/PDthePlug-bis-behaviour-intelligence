import { expect, test } from "@playwright/test";

test("learning timing in table cells stays separate from the Lab handoff", async ({ page }) => {
  await page.goto("/timing");
  const learning = page.getByRole("region", { name: "Learning session" });
  await expect(learning.locator("[data-source-timing]")).toHaveText("TIME: 45 minutes");
  await expect(learning.locator("[data-source-timing]")).toHaveAttribute("data-source-timing", "90 minutes");
  await expect(learning.getByText("The facilitated Lab takes 90 minutes.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lab handoff" })).toHaveText("TIME: 90 minutes");
});

test("learning questions have separate visible labels and preserve original answers", async ({ page }, info) => {
  await page.goto("/learning");
  const original = page.getByRole("textbox", { name: "What gives your life meaning?", exact: true });
  await expect(original).toHaveValue("An existing learner answer");
  await expect(original).toHaveAttribute("data-field-id", "PUR.WB.ORIGINAL");
  const second = page.getByRole("textbox", { name: "Where did this come from?", exact: true });
  await expect(second).toHaveAttribute("data-field-id", "PUR.WB.ORIGINAL.PART.2");
  await expect(second).toHaveValue("");
  await expect(page.locator(".authored-response-group").first()).toHaveScreenshot("learning-question-group.png", { animations: "disabled", maxDiffPixelRatio: 0.02 });
  await expect(page.getByRole("textbox")).toHaveCount(4);
  for (const label of ["What gives your life meaning?", "Where did this come from?", "What pattern repeats here?", "What evidence shows it happens?"]) {
    await expect(page.locator("label.generated-question-response-row > span", { hasText: label })).toBeVisible();
  }
  await second.fill("My family and teaching");
  await expect(original).toHaveValue("An existing learner answer");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await info.attach("learning-response-hierarchy", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
