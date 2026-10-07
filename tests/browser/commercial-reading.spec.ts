import { expect, test } from "@playwright/test";

const organisation = { id: "org-synthetic", name: "Synthetic organisation", organisation_type: "WORKPLACE", website: null, research_status: "VERIFIED", status: "ACTIVE", notes: null };
const opportunity = { id: "opp-synthetic", code: "SYNTHETIC", organisation_id: organisation.id, opportunity_name: "Synthetic workplace opportunity", lane: "WORKPLACE", edition: "WORKPLACE", buyer_group: "Learning team", opportunity_type: "PILOT", priority: "HIGH", stage: "RESEARCH", strategic_question: null, commercial_thesis: "Synthetic commercial context only.", recommended_tier: null, pathway: null, proposal_code: null, proposal_status: "DRAFT", contact_status: "NOT_STARTED", owner_email: "operator@fixture.invalid", wave: "WAVE_1", next_action: "Review synthetic record", next_action_due: "2026-10-07", hold_reason: null, last_activity_at: "2026-10-07" };
const snapshot = { identity: { email: "operator@fixture.invalid", displayName: "Fixture operator" }, roles: ["SYSTEM_ADMIN"], canWrite: true, canAdmin: true, canAssignRoles: true, metrics: { organisations: 1, opportunities: 2, school: 0, emergingAdult: 0, workplace: 1, waveOne: 2, frozenProposals: 0, discovery: 1, won: 0, openTasks: 1 }, organisations: [organisation], opportunities: [opportunity, { ...opportunity, id: "opp-second", opportunity_name: "Synthetic follow-up opportunity", stage: "DISCOVERY" }], contacts: [], proposals: [{ id: "proposal-synthetic", proposal_code: "SYNTHETIC-P", opportunity_id: opportunity.id, title: "Synthetic proposal", status: "DRAFT", edition: "WORKPLACE", version: "1.0", frozen_at: null, sent_at: null, document_url: null }], activities: [], tasks: [{ id: "task-synthetic", opportunity_id: opportunity.id, title: "Review synthetic record", status: "OPEN", priority: "HIGH", due_at: "2026-10-07", owner_email: "operator@fixture.invalid" }], controlledStages: ["RESEARCH", "DISCOVERY"] };

test("populated commercial queues keep secondary text readable and form controls usable", async ({ page }, info) => {
  let empty = false;
  await page.route("**/api/commercial", route => route.fulfill({ json: empty ? { ...snapshot, canWrite: false, proposals: [], tasks: [] } : snapshot }));
  for (const section of ["overview", "pipeline", "accounts", "tasks", "proposals"]) {
    await page.goto(`/commercial?section=${section}`);
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    await expect(page.getByText("Loading commercial workspace…", { exact: true })).toHaveCount(0);
    const contrast = await page.locator("main").evaluate(root => {
      const luminance = (colour: string) => colour.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      }).reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0);
      return [...root.querySelectorAll("small, p, [class*='rowButton'] span, [class*='tableHead'], [class*='nextAction'] span, [class*='cardMeta'] span")].filter(element => element.textContent?.trim() && element.getBoundingClientRect().height > 0).map(element => {
        let ancestor: Element | null = element;
        while (ancestor && getComputedStyle(ancestor).backgroundColor === "rgba(0, 0, 0, 0)") ancestor = ancestor.parentElement;
        const foreground = luminance(getComputedStyle(element).color), background = luminance(getComputedStyle(ancestor!).backgroundColor);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      });
    });
    if (section === "pipeline") {
      const pipeline = page.getByRole("region", { name: "Opportunity pipeline", exact: true });
      if (await pipeline.evaluate(element => element.scrollWidth > element.clientWidth + 1)) {
        await pipeline.focus(); await page.keyboard.press("ArrowRight");
        await expect.poll(() => pipeline.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
    }
    await page.screenshot({ path: info.outputPath(`commercial-${section}.png`) });
    await info.attach(`commercial-${section}-synthetic`, { path: info.outputPath(`commercial-${section}.png`), contentType: "image/png" });
    expect(contrast.length).toBeGreaterThan(0);
    expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  const create = page.getByRole("button", { name: "New opportunity" });
  await create.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Create opportunity", exact: true });
  await expect(dialog).toBeVisible();
  for (const field of await dialog.locator("input,select,button").all()) {
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  if (info.project.name.startsWith("mobile")) expect(await dialog.getByRole("textbox", { name: "Opportunity name" }).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(create).toBeFocused();
  empty = true;
  await page.goto("/commercial?section=proposals");
  await expect(page.getByRole("link", { name: "Review opportunities", exact: true })).toHaveAttribute("href", "/commercial?section=pipeline");
  await expect(page.getByRole("button", { name: "New opportunity" })).toBeDisabled();
  await page.goto("/commercial?section=tasks");
  await expect(page.getByText("There are no open tasks.", { exact: true })).toBeVisible();
  await info.attach("commercial-controls-synthetic", { body: await page.screenshot(), contentType: "image/png" });
});

test("commercial navigation returns to the saved dark Profile appearance", async ({ page }) => {
  await page.route("**/api/commercial", route => route.fulfill({ json: snapshot }));
  await page.route("**/api/profile", route => route.fulfill({ json: { profile: null, roles: ["SYSTEM_ADMIN"] } }));
  await page.goto("/commercial");
  await page.evaluate(() => { document.documentElement.dataset.bisAppearance = "dark"; });
  await page.getByRole("button", { name: /Open BIS menu/ }).click();
  await page.locator('[href="/profile"]').click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("link", { name: "Open commercial workspace" })).toBeVisible();
  expect(await page.locator(".canonical-shell").evaluate(element => {
    const background = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    return Math.max(...background);
  })).toBeLessThan(50);
});
