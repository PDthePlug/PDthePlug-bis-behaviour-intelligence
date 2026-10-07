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
  assert.match(dashboard, /Sign out/);
});

test("staff access remains assigned and invisible to learner-only profiles", async () => {
  const staff = await source("app/workspace/staff-workspace-shell.tsx");
  const profile = await source("app/profile/profile-dashboard.tsx");

  assert.match(staff, /fetch\("\/api\/staff"/);
  assert.match(staff, /href="\/profile"/);
  assert.match(profile, /const staff = hasStaffRole\(roles\)/);
  assert.match(profile, /\{staff \? <Link href="\/workspace"/);
  assert.match(profile, /\{commercial \? <Link href="\/commercial"/);
  assert.match(profile, /Open programme workspace/);
  assert.doesNotMatch(staff, /register as facilitator/i);
  assert.doesNotMatch(profile, /register as facilitator/i);
});

test("learner chrome removes repeated help and explanatory footer", async () => {
  const canonical = await source("app/canonical-adaptive-shell.tsx");

  assert.doesNotMatch(canonical, /Screen guide/);
  assert.doesNotMatch(canonical, /canonical-menu-foot/);
  assert.doesNotMatch(canonical, /multi-lab-route-banner/);
  assert.doesNotMatch(canonical, /multi-lab-menu-privacy/);
});

test("active Habit, Decision and Money tasks share the universal progress surface", async () => {
  const flow = await source("app/lab-investigation-frame.css");
  const decision = await source("app/decision/layout.tsx");
  const money = await source("app/money/layout.tsx");
  const habit = await source("app/habit-lab/layout.tsx");

  assert.match(flow, /universal-lab-progress/);
  assert.match(flow, /universal-investigation-nav/);
  for (const layout of [decision, money, habit]) {
    assert.match(layout, /lab-investigation-frame\.css/);
  }
});

test("sign-in introduction states the BIS idea without implementation explanation", async () => {
  const form = await source("app/sign-in/sign-in-form.tsx");

  assert.match(form, /Behaviour comes before results\./);
  assert.doesNotMatch(form, /One identity\. The right BIS experience\./);
  assert.doesNotMatch(form, /BIS resolves your role, learner profile and delivery edition/);
  assert.doesNotMatch(form, /Edition-aware learning/);
});
