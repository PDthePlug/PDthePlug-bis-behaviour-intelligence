import { expect, test, type Page } from "@playwright/test";

const commercialSnapshot = {
  identity: { email: "staff@local.invalid", displayName: "Staff" },
  roles: ["SYSTEM_ADMIN"],
  canWrite: true,
  canAdmin: true,
  metrics: {
    organisations: 1,
    opportunities: 1,
    school: 0,
    emergingAdult: 1,
    workplace: 0,
    waveOne: 1,
    frozenProposals: 0,
    discovery: 0,
    won: 0,
    openTasks: 1,
  },
  organisations: [{
    id: "org-1",
    name: "Leap9",
    organisation_type: "Youth development",
    website: null,
    research_status: "VERIFIED",
    status: "ACTIVE",
    notes: null,
  }],
  contacts: [{
    id: "contact-1",
    organisation_id: "org-1",
    full_name: "Programme Lead",
    job_title: "Programme Lead",
    email: "lead@example.invalid",
    phone: null,
    linkedin_url: null,
    buying_role: "Programme owner",
    verification_status: "VERIFIED",
    is_primary: true,
  }],
  opportunities: [{
    id: "opp-1",
    code: "CRM-E99",
    organisation_id: "org-1",
    opportunity_name: "Leap9 Participant Development",
    lane: "EMERGING_ADULT",
    edition: "Emerging Adult 18–25",
    buyer_group: "Programme",
    opportunity_type: "Commercial prospect",
    priority: "HIGH",
    stage: "DRAFT_READY",
    strategic_question: null,
    commercial_thesis: "Make learning-to-behaviour transfer visible.",
    recommended_tier: null,
    pathway: null,
    proposal_code: null,
    proposal_status: "NOT_STARTED",
    contact_status: "VERIFIED",
    owner_email: "staff@local.invalid",
    wave: "WAVE_1",
    next_action: "OUTREACH QC PASSED — recipient-safe Launch A candidate. Keep unscheduled until explicit send approval is given.",
    next_action_due: "2026-10-06",
    hold_reason: null,
    last_activity_at: null,
  }],
  proposals: [],
  tasks: [{
    id: "task-1",
    opportunity_id: "opp-1",
    title: "Review outreach",
    status: "OPEN",
    priority: "HIGH",
    due_at: "2026-10-06T08:00:00Z",
    owner_email: "staff@local.invalid",
  }],
  activities: [],
  controlledStages: ["RESEARCH", "THESIS_READY", "DRAFT_READY", "CONTACTED"],
};

const liveRecommendation = {
  signalKey: "opp-1:OUTREACH_APPROVAL:review",
  opportunityId: "opp-1",
  opportunityCode: "CRM-E99",
  organisationName: "Leap9",
  opportunityName: "Leap9 Participant Development",
  kind: "OUTREACH_APPROVAL",
  priority: "URGENT",
  title: "Leap9 Participant Development is prepared for a human send decision",
  rationale: "The CRM says outreach QC passed, a verified direct route exists, and the remaining instruction is explicit send approval.",
  recommendedAction: "Review the prepared outreach and approve or hold the send.",
  evidence: [
    { label: "Verified contacts", value: "1" },
    { label: "Stage", value: "DRAFT_READY" },
    { label: "Wave", value: "WAVE_1" },
  ],
  confidence: 96,
  score: 99,
  requiresApproval: true,
};

function intelligenceState(refreshed: boolean, dismissed = false) {
  return {
    canWrite: true,
    aiConfigured: true,
    needsRefresh: !refreshed,
    live: {
      headline: "1 commercial action needs immediate attention.",
      summary: "1 item needs a human approval decision",
      generatedAt: "2026-10-07T00:00:00Z",
      metrics: { urgent: 1, approvals: 1, research: 0, followUps: 0, stale: 0, activeOpportunities: 1 },
      recommendations: [liveRecommendation],
    },
    latestRun: refreshed ? {
      id: "run-1",
      summary: "Leap9 is the clearest decision today: review the prepared outreach and decide whether to send.",
      provider: "AI_GATEWAY",
      model: "gpt-5.6-luna",
      created_at: "2026-10-07T00:02:00Z",
      input_fingerprint: "fixture",
    } : null,
    recommendations: refreshed ? [{
      id: "rec-1",
      opportunity_id: "opp-1",
      kind: "OUTREACH_APPROVAL",
      priority: "URGENT",
      title: liveRecommendation.title,
      rationale: liveRecommendation.rationale,
      recommended_action: liveRecommendation.recommendedAction,
      evidence: liveRecommendation.evidence,
      confidence: 96,
      score: 99,
      status: dismissed ? "DISMISSED" : "OPEN",
      requires_approval: true,
    }] : [],
  };
}

async function mockCommercial(page: Page) {
  let refreshed = false;
  let dismissed = false;
  let refreshCount = 0;

  await page.route("**/api/commercial", async route => {
    await route.fulfill({ json: commercialSnapshot });
  });

  await page.route("**/api/commercial/intelligence", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: intelligenceState(refreshed, dismissed) });
      return;
    }
    const body = route.request().postDataJSON();
    if (body.action === "refresh") {
      refreshed = true;
      refreshCount += 1;
      await route.fulfill({ json: { run: { id: "run-1" }, recommendations: [] } });
      return;
    }
    if (body.action === "ask") {
      await route.fulfill({
        json: {
          answer: "Leap9 is the clearest approval decision in the current CRM.",
          provider: "AI_GATEWAY",
          model: "gpt-5.6-luna",
        },
      });
      return;
    }
    if (body.action === "draft") {
      await route.fulfill({
        json: {
          artifact: { id: "draft-1", status: "DRAFT" },
          draft: "Hello,\n\nFollowing our conversation, we made the BIS programme experience more tangible for Leap9.\n\nKind regards",
          provider: "AI_GATEWAY",
          model: "gpt-5.6-luna",
        },
      });
      return;
    }
    if (body.action === "decision") {
      dismissed = body.decision === "DISMISSED";
      await route.fulfill({ json: { recommendation: { id: "rec-1", status: body.decision } } });
      return;
    }
    await route.fulfill({ status: 400, json: { error: "Unsupported action" } });
  });

  return {
    get refreshCount() {
      return refreshCount;
    },
  };
}

test("Commercial Intelligence automatically prepares the daily founder brief and keeps sends human-controlled", async ({ page }) => {
  const state = await mockCommercial(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/commercial");
  await expect(page.getByRole("heading", { level: 1, name: "Partnerships, pipeline and execution." })).toBeVisible();
  await page.getByRole("button", { name: "Commercial Intelligence", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Commercial Intelligence." })).toBeVisible();
  await expect(page.getByText("Founder operating brief", { exact: true })).toBeVisible();
  await expect.poll(() => state.refreshCount).toBe(1);
  await expect(page.getByText("Leap9 is the clearest decision today: review the prepared outreach and decide whether to send.")).toBeVisible();
  await expect(page.getByText("Leap9 Participant Development is prepared for a human send decision")).toBeVisible();

  await page.getByRole("button", { name: "Prepare draft" }).click();
  await expect(page.getByRole("heading", { name: "Prepared outreach" })).toBeVisible();
  await expect(page.getByText("Draft only · nothing has been sent", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send/i })).toHaveCount(0);

  await page.getByLabel("Your question").fill("What should I focus on today?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Leap9 is the clearest approval decision in the current CRM.")).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("No immediate commercial exceptions.")).toBeVisible();
});

for (const width of [360, 430, 1280]) {
  test("Commercial Intelligence remains usable without page overflow at " + width + "px", async ({ page }) => {
    await mockCommercial(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commercial?section=intelligence");
    await expect(page.getByText("What deserves your attention", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Your question")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("the commercial board includes production DRAFT_READY opportunities", async ({ page }) => {
  await mockCommercial(page);
  await page.goto("/commercial?section=pipeline");
  await expect(page.getByText("Draft Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Leap9 Participant Development", { exact: true })).toBeVisible();
});

test('an empty Intelligence response offers recovery without rendering an invented brief', async ({ page }) => {
  await mockCommercial(page);
  let unavailable = true;
  await page.route('**/api/commercial/intelligence', async route => {
    if (route.request().method() === 'GET' && unavailable) { await route.fulfill({ json: null }); return; }
    await route.fallback();
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/commercial?section=intelligence');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText('Founder operating brief', { exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Founder operating brief', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('revoked Intelligence access clears the loaded recommendation and prepared draft', async ({ page }) => {
  await mockCommercial(page);
  await page.goto('/commercial?section=intelligence');
  await expect(page.getByRole('button', { name: 'Prepare draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare draft' }).click();
  await expect(page.getByRole('heading', { name: 'Prepared outreach' })).toBeVisible();
  await page.route('**/api/commercial/intelligence', async route => {
    if (route.request().method() === 'POST') { await route.fulfill({ status: 403, json: { error: 'Your commercial access has ended.' } }); return; }
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByRole('alert')).toContainText('Your commercial access has ended.');
  await expect(page.getByRole('heading', { name: 'Prepared outreach' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Approve / Accept' })).toHaveCount(0);
});
