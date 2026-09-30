import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const modules = ["habit", "decision", "money", "identity", "attention"];
const emergingHandbooks = modules.map((name) => `${name}-emerging_adult`);
const workplaceHandbooks = modules.map((name) => `${name}-workplace`);

const highLoadTerms = [
  "falsification",
  "adherence",
  "calibration",
  "provenance",
  "diagnostic",
  "impact domains",
  "deliberateness",
  "agency shift",
  "automaticity",
  "cognitive load",
  "contradictory evidence",
  "derived measures",
  "behaviour evidence indicator",
];

function decodeHandbook(name) {
  return source(`public/handbooks/v1/${name}.json.gz.b64`).then((raw) =>
    JSON.parse(gunzipSync(Buffer.from(raw.trim(), "base64")).toString("utf8")),
  );
}

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function rulesSection(language, start, end) {
  const from = language.indexOf(start);
  const to = language.indexOf(end, from + start.length);
  assert.ok(from >= 0, `Missing language rules section: ${start}`);
  assert.ok(to > from, `Could not find end of language rules section: ${end}`);
  return language.slice(from, to).toLowerCase();
}

test("all five Emerging Adult and Workplace handbooks are present and edition-specific", async () => {
  const emerging = await Promise.all(emergingHandbooks.map(decodeHandbook));
  const workplace = await Promise.all(workplaceHandbooks.map(decodeHandbook));

  assert.equal(emerging.length, 5);
  assert.equal(workplace.length, 5);
  for (const programme of emerging) assert.equal(programme.edition, "emerging_adult");
  for (const programme of workplace) assert.equal(programme.edition, "workplace");
});

test("Emerging Adult corpus vocabulary is covered by the Emerging Adult language standard", async () => {
  const language = await source("lib/school-language.ts");
  const rules = rulesSection(language, "const EMERGING_ADULT_RULES", "const WORKPLACE_RULES");
  const corpus = (await Promise.all(emergingHandbooks.map(decodeHandbook)))
    .flatMap((programme) => programme.treatment.pages.map((page) => plainText(page.html)))
    .join(" ")
    .toLowerCase();

  const present = highLoadTerms.filter((term) => corpus.includes(term));
  assert.ok(present.length >= 3, "The Emerging Adult audit should exercise real specialist vocabulary.");

  for (const term of present) {
    assert.ok(rules.includes(term), `Emerging Adult term "${term}" is not governed by its edition rules.`);
  }
});

test("Workplace corpus vocabulary is covered by the Workplace language standard", async () => {
  const language = await source("lib/school-language.ts");
  const rules = rulesSection(language, "const WORKPLACE_RULES", "export function schoolLearnerText");
  const corpus = (await Promise.all(workplaceHandbooks.map(decodeHandbook)))
    .flatMap((programme) => programme.treatment.pages.map((page) => plainText(page.html)))
    .join(" ")
    .toLowerCase();

  const present = highLoadTerms.filter((term) => corpus.includes(term));
  assert.ok(present.length >= 3, "The Workplace audit should exercise real specialist vocabulary.");

  for (const term of present) {
    assert.ok(rules.includes(term), `Workplace term "${term}" is not governed by its edition rules.`);
  }
});

test("Emerging Adult language stays mature without reverting to school wording", async () => {
  const language = await source("lib/school-language.ts");
  const rules = rulesSection(language, "const EMERGING_ADULT_RULES", "const WORKPLACE_RULES");

  for (const [technical, replacement] of [
    ["falsification", "testing what could show the explanation is wrong"],
    ["adherence", "plan consistency"],
    ["calibration", "checking your prediction against what happened"],
    ["provenance", "evidence source"],
    ["deliberateness", "intentional decision-making"],
    ["agency shift", "change in perceived control"],
    ["automaticity", "automatic behaviour"],
    ["cognitive load", "mental effort"],
  ]) {
    assert.ok(rules.includes(technical), `Missing Emerging Adult term: ${technical}`);
    assert.ok(rules.includes(replacement), `Missing Emerging Adult wording: ${replacement}`);
  }

  assert.doesNotMatch(rules, /doing something automatically/);
  assert.doesNotMatch(rules, /how much evidence you have/);
});

test("Workplace language is concise, professional and participant-oriented", async () => {
  const language = await source("lib/school-language.ts");
  const rules = rulesSection(language, "const WORKPLACE_RULES", "export function schoolLearnerText");

  for (const [technical, replacement] of [
    ["Learner View", "Participant View"],
    ["adherence", "plan follow-through"],
    ["calibration", "prediction-to-outcome check"],
    ["provenance", "evidence source"],
    ["traceable evidence", "evidence with a clear audit record"],
    ["deliberateness", "intentional decision-making"],
    ["agency shift", "change in perceived control"],
    ["real-world test", "field test"],
  ]) {
    assert.ok(rules.includes(technical.toLowerCase()), `Missing Workplace term: ${technical}`);
    assert.ok(rules.includes(replacement.toLowerCase()), `Missing Workplace wording: ${replacement}`);
  }
});

test("edition language is applied in handbooks, Habit Lab, core Labs and Universal Labs", async () => {
  const [player, enhancement, habit, core, universal] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/learning/handbook-document-enhancements.ts"),
    source("app/bis-app.tsx"),
    source("app/core-lab-experience.tsx"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
  ]);

  assert.match(player, /EditionLanguageScope edition=\{snapshot\.profile\.deliveryEdition\}/);
  assert.match(enhancement, /learnerText\(before, context\.edition\)/);
  assert.match(habit, /EditionLanguageScope edition=\{edition\} enabled=\{systemMode === "learner"\}/);
  assert.match(core, /EditionLanguageScope edition=\{edition\}/);
  assert.match(universal, /EditionLanguageScope edition=\{snapshot\.deliveryEdition\}/);
});

test("participant-facing Core Lab metadata is distinct by edition", async () => {
  const core = await source("app/core-lab-experience.tsx");

  assert.match(core, /badge: "School Edition"/);
  assert.match(core, /badge: "Emerging Adult Edition"/);
  assert.match(core, /badge: "Workplace Edition"/);
  assert.match(core, /Ages 18–25 · Independent or facilitated/);
  assert.match(core, /Workplace participants · No prior BIS knowledge needed/);
  assert.match(core, /7-day field test/);
});
