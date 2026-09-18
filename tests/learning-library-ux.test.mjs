import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Today and Learn are distinct route-owned destinations", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const entry = await source("app/habit/programme-entry.tsx");
  const page = await source("app/habit/page.tsx");
  const shell = await source("app/canonical-adaptive-shell.tsx");
  const library = await source("app/learn/page.tsx");

  assert.match(shell, /href: "\/learn"/);
  assert.match(library, /<ModuleLibrary mode="learning" \/>/);
  assert.match(page, /params\.section === "learn" && params\.module !== "HAB"/);
  assert.match(page, /redirect\("\/learn"\)/);
  assert.match(entry, /initialLearnMode=\{initialLearnMode\}/);
  assert.match(player, /useState<LearnMode>\(initialLearnMode\)/);
  assert.match(player, /openLearn\("reader"\)[\s\S]*Continue learning/);
});

test("Learn opens the shared 34-handbook catalogue without profile explanation", async () => {
  const library = await source("app/catalogue/module-library.tsx");
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));

  assert.equal(catalogue.modules.length, 34);
  assert.match(library, /Learning library/);
  assert.match(library, /Choose a handbook to open or continue/);
  assert.doesNotMatch(library, /Learner profile context/);
  assert.doesNotMatch(library, /Workplace Edition/);
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

test("delivery edition stays in the data model and Profile but not repeated learning chrome", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const profile = await source("app/profile/profile-dashboard.tsx");
  const learningApi = await source("app/api/learning/route.ts");
  const bisApi = await source("app/api/bis/route.ts");

  assert.match(player, /deliveryEdition: Edition/);
  assert.match(learningApi, /contentReleases\.deliveryEdition, profile\.deliveryEdition/);
  assert.match(bisApi, /deliveryEdition: profile\?\.deliveryEdition/);

  assert.doesNotMatch(player, /School Edition|Emerging Adult Edition|Workplace Edition/);
  assert.match(profile, /School Edition/);
  assert.match(profile, /Emerging Adult Edition/);
  assert.match(profile, /Workplace Edition/);
});
