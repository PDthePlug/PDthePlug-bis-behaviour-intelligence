import { expect, test } from "@playwright/test";

test("safeguarding severity and resolution remain named and keyboard operable", async ({ page }, info) => {
  const learner = { displayName: "Synthetic learner", email: "fixture@local.invalid" };
  const cases = [
    { id: "case-open", learner, sourceType: "FACILITATOR_REFERRAL", status: "OPEN", category: "SUPPORT_REQUEST", summary: "Synthetic support request only.", openedAt: "2026-10-07" },
    { id: "case-assigned", learner, sourceType: "LEARNER_REQUEST", status: "ACKNOWLEDGED", category: "SUPPORT_REQUEST", summary: "Synthetic follow-up only.", openedAt: "2026-10-07", severity: "LOW", acknowledgedAt: "2026-10-07", assignedToEmail: "officer@local.invalid" },
  ];
  const snapshot = { identity: { id: "officer", email: "officer@local.invalid", displayName: "Fixture officer" }, roles: ["SAFEGUARDING_OFFICER"], privacyBoundary: {}, admin: null, facilitator: null, sponsor: null, safeguarding: { cases } };
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/staff", route => {
    if (route.request().method() === "POST") writes.push(route.request().postDataJSON());
    return route.fulfill({ json: snapshot });
  });
  await page.goto("/staff-shell?view=facilitator&section=support");
  const severity = page.getByRole("combobox", { name: "Case severity", exact: true });
  await expect(severity).toBeVisible();
  await severity.focus(); await page.keyboard.press("Enter");
  const high = page.getByRole("option", { name: "High", exact: true });
  await expect(high).toBeVisible(); await high.focus(); await page.keyboard.press("Enter");
  await expect(severity).toHaveText("High");
  await page.getByRole("button", { name: "Acknowledge and assign to me" }).click();
  await expect.poll(() => writes[0]).toEqual({ action: "acknowledgeSafeguardingCase", caseId: "case-open", severity: "HIGH" });
  await page.getByRole("textbox", { name: "Resolution and handoff outcome", exact: true }).fill("Synthetic handoff completed.");
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect.poll(() => writes[1]).toEqual({ action: "resolveSafeguardingCase", caseId: "case-assigned", resolutionNote: "Synthetic handoff completed." });
  const contrast = await page.locator(".case-summary > span").first().evaluate(element => {
    const foreground = getComputedStyle(element).color;
    const background = getComputedStyle(element.parentElement!).backgroundColor;
    const luminance = (rgb: string) => rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0);
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await info.attach("synthetic-safeguarding-controls", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
