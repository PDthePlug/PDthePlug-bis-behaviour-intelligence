import { test, expect } from "@playwright/test";

const cohort = { id: "group", name: "Opportunity coverage fixture", labCode: "SYS", labVersion: "1", status: "ACTIVE", memberIds: [] };
const learner = { userId: "learner", cohortId: "group", displayName: "Coverage learner", email: "coverage@local.invalid", enrolment: { id: "enrolment", status: "ACTIVE", currentInvestigation: 7, experimentStartedAt: "2026-10-01T00:00:00Z", labVersion: "1" }, experiment: null };
const cases = [
  { name: "no learners", counts: [], bands: null },
  { name: "unavailable counts", counts: [null, null], bands: null },
  { name: "recorded zero", counts: [0], bands: [1, 0, 0, 0] },
  { name: "mixed coverage", counts: [null, 0, 1, 2, 4], bands: [1, 1, 1, 1] },
] as const;

for (const role of ["facilitator", "admin"] as const) for (const fixture of cases) {
  test(`${role} distinguishes ${fixture.name} from recorded opportunities`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const learners = fixture.counts.map((count, index) => ({ ...learner, userId: `learner-${index}`, experiment: count === null ? null : { opportunityCount: count, recordedDays: 3, minimumEvidenceThreshold: 3, status: "ACTIVE" } }));
    const data = { cohorts: [cohort], learners, notes: [], referrals: [], roleAssignments: [], labAssignments: [], supportedLabVersions: [], publishedLabs: [], metrics: { learners: learners.length, completed: 0, experimentActive: learners.length, openSafeguardingCases: 0, opportunityBands: { none: fixture.bands?.[0] ?? 0, one: fixture.bands?.[1] ?? 0, two: fixture.bands?.[2] ?? 0, threePlus: fixture.bands?.[3] ?? 0 } } };
    await page.route("**/api/staff", route => route.fulfill({ json: { identity: { id: "staff", displayName: "Coverage staff", email: "staff@local.invalid" }, roles: ["FACILITATOR", "SYSTEM_ADMIN"], privacyBoundary: {}, admin: role === "admin" ? data : null, facilitator: role === "facilitator" ? data : null, sponsor: null, safeguarding: null } }));
    await page.route("**/api/class-operations?**", route => route.fulfill({ json: { sessions: [], attendance: [] } }));
    await page.goto(`/staff-shell?view=${role}&group=group`);
    const section = page.locator(".ops-section").filter({ has: page.getByRole("heading", { name: role === "admin" ? "Real-world opportunities" : "Opportunities recorded", exact: true }) });
    await expect(section).toBeVisible();
    if (!fixture.counts.length) await expect(section).toContainText("No learners are included in this view yet.");
    else if (!fixture.bands) {
      await expect(section).toContainText("Opportunity counts are not available");
      await expect(section).toContainText("A recorded experiment start does not tell us whether an opportunity occurred.");
    } else {
      await expect(section).toContainText(`Recorded opportunity counts are available for ${fixture.counts.filter(count => count !== null).length} of ${fixture.counts.length} learners.`);
      await expect(section.locator(".opportunity-bands strong")).toHaveText(fixture.bands.map(String));
      await expect(section.getByText("0 recorded", { exact: true })).toBeVisible();
      const disclosure = section.locator("details");
      await expect(disclosure.getByText(/Zero means/)).toBeHidden();
      await disclosure.locator("summary").focus(); await page.keyboard.press("Enter");
      await expect(disclosure.getByText(/Zero means no opportunity is recorded/)).toBeVisible();
      await expect(disclosure).toContainText("Learners without an available count are excluded");
      await page.keyboard.press("Enter"); await expect(disclosure).not.toHaveAttribute("open");
    }
    if (!fixture.bands) await expect(section.locator(".opportunity-bands")).toHaveCount(0);
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/opportunity-${role}-${fixture.name.replaceAll(" ", "-")}-${info.project.name}.png` });
    await page.reload(); await expect(section).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
