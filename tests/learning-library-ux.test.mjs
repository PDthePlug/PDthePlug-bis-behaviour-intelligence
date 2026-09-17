import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Today and Learn are distinct route-owned destinations", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const page = await source("app/habit/page.tsx");
  const shell = await source("app/canonical-adaptive-shell.tsx");

  assert.match(page, /params\.section === "learn" \? "learn" : "today"/);
  assert.match(shell, /href: "\/habit\?section=learn"/);
  assert.match(player, /setSection\(initialSection\)/);
  assert.match(player, /if \(initialSection === "learn"\) setLearnMode\("library"\)/);
  assert.match(player, /useState<LearnMode>\("library"\)/);
  assert.match(player, /Continue learning[\s\S]*openLearn\("reader"\)/);
});

test("Learn opens a concise handbook library without repeating profile classification", async () => {
  const player = await source("app/learning/programme-player.tsx");

  assert.match(player, /Learning library\./);
  assert.match(player, /Choose a handbook to open or continue\./);
  assert.match(player, /<h2>Handbooks<\/h2>/);
  assert.doesNotMatch(player, /Learner profile context/);
  assert.doesNotMatch(player, /One learner profile\. One learning environment\./);
  assert.doesNotMatch(player, /Workplace Edition/);
  assert.doesNotMatch(player, /deliveryEdition:/);
});

test("handbook reader uses a compact progress header instead of a repeated cover", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const css = await source("app/learner-readability.css");

  assert.match(player, /prototype-reader-hero-compact/);
  assert.match(player, /Habit Investigation Handbook/);
  assert.match(player, /Day \$\{page\.programmeDay\} of 10/);
  assert.match(player, /\{progressPercent\}%/);
  assert.doesNotMatch(player, /Ten days\. One repeated behaviour\. Your learning material stays here/);
  assert.doesNotMatch(player, /<h1>The Habit Investigation Handbook<\/h1>/);
  assert.match(css, /prototype-reader-hero-compact[\s\S]*padding:\s*18px 22px/);
});

test("delivery edition remains a profile concern rather than repeated learning chrome", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const profile = await source("app/profile/profile-dashboard.tsx");

  assert.doesNotMatch(player, /School Edition|Emerging Adult Edition|Workplace Edition/);
  assert.match(profile, /School Edition/);
  assert.match(profile, /Emerging Adult Edition/);
  assert.match(profile, /Workplace Edition/);
});
