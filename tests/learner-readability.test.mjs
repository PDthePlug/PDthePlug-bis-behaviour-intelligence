import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/canonical-adaptive-shell.tsx", import.meta.url), "utf8");
const entry = readFileSync(new URL("../app/habit/programme-entry.tsx", import.meta.url), "utf8");
const player = readFileSync(new URL("../app/learning/programme-player.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/learner-readability.css", import.meta.url), "utf8");
const habitLayout = readFileSync(new URL("../app/habit/layout.tsx", import.meta.url), "utf8");
const labLayout = readFileSync(new URL("../app/habit-lab/layout.tsx", import.meta.url), "utf8");

test("learner shell uses concise task and account language", () => {
  for (const phrase of [
    "Your next step",
    "Browse handbooks",
    "Browse investigations",
    "Seven days of real-world observation",
    "Account and sign out",
  ]) {
    assert.ok(shell.includes(phrase), `${phrase} should be present`);
  }

  for (const phrase of [
    "without duplicating evidence",
    "One programme. One learner shell.",
    "One programme. One clear path.",
    "Screen guide",
  ]) {
    assert.ok(!shell.includes(phrase), `${phrase} should not remain in learner-facing shell copy`);
  }
});

test("learner onboarding removes classification and product implementation wording", () => {
  for (const phrase of [
    "Tell BIS a little about how you are learning.",
    "Your BIS journey starts here",
    "Private by design:",
    "Start BIS",
  ]) {
    assert.ok(entry.includes(phrase), `${phrase} should be present`);
  }

  for (const phrase of [
    "Your classification is stored once",
    "authored delivery edition",
    "formal Lab inputs and field-experiment evidence remain distinct records",
    "Restore product consent",
  ]) {
    assert.ok(!entry.includes(phrase), `${phrase} should not remain in onboarding copy`);
  }
});

test("readability layer is applied to programme and Lab routes", () => {
  assert.match(habitLayout, /learner-readability\.css/);
  assert.match(labLayout, /learner-readability\.css/);
});

test("readability layer enforces comfortable learner text and touch targets", () => {
  assert.match(css, /\.prototype-document p,[\s\S]*font-size: 16px/);
  assert.match(css, /\.prototype-document textarea \{[\s\S]*font-size: 16px/);
  assert.match(css, /\.prototype-btn,[\s\S]*min-height: 44px/);
  assert.match(css, /\.habit-lab-route button,[\s\S]*min-height: 44px/);
  assert.match(css, /@media \(max-width: 430px\)/);
});

test("known implementation-only programme copy is removed from the learner experience", () => {
  assert.match(css, /\.prototype-today-hero > div:first-child > p:not\(\.prototype-eyebrow\)[\s\S]*display: none/);
  for (const phrase of [
    "Learner profile context",
    "One learner profile. One learning environment.",
    "The edition is already resolved from your persisted BIS learner profile",
    "Source preserved · production reader migration held",
    "Workplace Edition",
  ]) {
    assert.ok(!player.includes(phrase), `${phrase} should not remain in learner-facing programme chrome`);
  }
  assert.match(css, /Coming later/);
});
