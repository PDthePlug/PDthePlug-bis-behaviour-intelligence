import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Profile is an authenticated learner destination with sign out", async () => {
  const page = await source("app/profile/page.tsx");
  const dashboard = await source("app/profile/profile-dashboard.tsx");
  const shell = await source("app/canonical-adaptive-shell.tsx");

  assert.match(page, /requireUser\("\/profile"\)/);
  assert.match(shell, /label: "Profile"/);
  assert.match(shell, /href: "\/profile"/);
  assert.match(dashboard, /action="\/auth\/signout"/);
  assert.match(dashboard, /method="post"/);
  assert.match(dashboard, /Sign out or switch account/);
});

test("staff access remains assigned and invisible to learner-only profiles", async () => {
  const staff = await source("app/workspace/staff-workspace-shell.tsx");
  const profile = await source("app/profile/profile-dashboard.tsx");

  assert.match(staff, /fetch\("\/api\/staff"/);
  assert.match(staff, /href="\/profile"/);
  assert.match(profile, /const staff = hasStaffRole\(roles\)/);
  assert.match(profile, /\{staff \? \(/);
  assert.match(profile, /Open staff dashboard/);
  assert.doesNotMatch(staff, /register as facilitator/i);
  assert.doesNotMatch(profile, /register as facilitator/i);
});

test("learner chrome removes repeated help and explanatory footer", async () => {
  const canonical = await source("app/canonical-adaptive-shell.tsx");
  const multi = await source("app/multi-lab-adaptive-shell.tsx");

  assert.doesNotMatch(canonical, /Screen guide/);
  assert.doesNotMatch(canonical, /canonical-menu-foot/);
  assert.doesNotMatch(multi, /Screen guide/);
  assert.doesNotMatch(multi, /multi-lab-route-banner/);
  assert.doesNotMatch(multi, /multi-lab-menu-privacy/);
});

test("active Decision and Money tasks begin directly under progress", async () => {
  const flow = await source("app/multi-lab-flow-cleanup.css");
  const decision = await source("app/decision/layout.tsx");
  const money = await source("app/money/layout.tsx");

  assert.match(flow, /corelab-progressbar[\s\S]*margin-top:\s*0/);
  assert.match(decision, /multi-lab-flow-cleanup\.css/);
  assert.match(money, /multi-lab-flow-cleanup\.css/);
});

test("sign-in introduction states the BIS idea without implementation explanation", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");

  assert.match(form, /Behaviour comes before results\./);
  assert.doesNotMatch(form, /One identity\. The right BIS experience\./);
  assert.doesNotMatch(form, /BIS resolves your role, learner profile and delivery edition/);
  assert.doesNotMatch(form, /Edition-aware learning/);
});
