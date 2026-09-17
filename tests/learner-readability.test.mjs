import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/canonical-adaptive-shell.tsx", import.meta.url), "utf8");
const entry = readFileSync(new URL("../app/habit/programme-entry.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/learner-readability.css", import.meta.url), "utf8");
const habitLayout = readFileSync(new URL("../app/habit/layout.tsx", import.meta.url), "utf8");
const labLayout = readFileSync(new URL("../app/habit-lab/layout.tsx", import.meta.url), "utf8");

test("learner shell uses task language instead of system implementation language", () => {
  for (const phrase of [
    "Your next step in the Habit programme.",
    "Handbook and workbook",
    "Guided Habit investigation",
    "Seven days of real-world observation",
    "One programme. One clear path.",
  ]) {
    assert.ok(shell.includes(phrase), `${phrase} should be present`);
  }

  for (const phrase of ["without duplicating evidence", "One programme. One learner shell."]) {
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

test("known implementation-only programme copy is removed from the visible learner surface", () => {
  assert.match(css, /\.prototype-today-hero > div:first-child > p:not\(\.prototype-eyebrow\)[\s\S]*display: none/);
  assert.match(css, /\.prototype-profile-card > p:not\(\.prototype-eyebrow\),[\s\S]*display: none/);
  assert.match(css, /\.prototype-profile-banner > p,[\s\S]*\.prototype-library-note[\s\S]*display: none/);
  assert.match(css, /Coming later/);
});
