import { expect, test } from "@playwright/test";

test("recovered handbook corrections preserve readable meaning and stable saved responses", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/handbook-recovery");
  await expect(page.getByRole("heading", { level: 1, name: "Reading your evidence" })).toBeVisible();
  const choice = page.getByRole("checkbox", { name: "Observe the context before interpreting the result", exact: true });
  await expect(choice).toBeVisible();
  await choice.check();
  await expect(choice).toBeChecked();
  await expect(page.getByText("Prediction Accuracy = 100 − |Predicted % − Actual %|", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Your evidence notes" })).toHaveCount(1);
  const answer = page.getByRole("textbox", { name: "At work — Your evidence notes", exact: true });
  const fieldId = await answer.getAttribute("data-field-id");
  await answer.fill("A saved observation remains attached to its original question.");
  await page.reload();
  await expect(answer).toHaveValue("A saved observation remains attached to its original question.");
  await expect(answer).toHaveAttribute("data-field-id", fieldId!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
