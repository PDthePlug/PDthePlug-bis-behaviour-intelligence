import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const schoolHandbooks = [
  "habit-school",
  "decision-school",
  "money-school",
  "identity-school",
  "attention-school",
];

const highLoadTerms = [
  "automaticity",
  "provenance",
  "falsification",
  "adherence",
  "calibration",
  "diagnostic",
  "impact domains",
  "deliberateness",
  "agency shift",
  "synthesise",
  "cognitive load",
  "contradictory evidence",
  "provisional explanation",
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

test("the BIS learner language system routes every edition through its own governed transform", async () => {
  const language = await source("lib/school-language.ts");

  assert.match(language, /edition === "school".*schoolLearnerText/s);
  assert.match(language, /edition === "emerging_adult".*emergingAdultLearnerText/s);
  assert.match(language, /edition === "workplace".*workplaceLearnerText/s);
  assert.match(language, /plain meaning first/i);
  assert.match(language, /evidence model, facilitator views and sponsor reporting/i);
});

test("all five live school handbooks pass through the edition-aware learner language layer", async () => {
  const [player, enhancement] = await Promise.all([
    source("app/learning/programme-player.tsx"),
    source("app/learning/handbook-document-enhancements.ts"),
  ]);

  assert.match(player, /edition: programme\?\.edition \?\? snapshot\?\.profile\.deliveryEdition/);
  assert.match(player, /EditionLanguageScope edition=\{snapshot\.profile\.deliveryEdition\}/);
  assert.match(enhancement, /if \(!context\.edition\) return/);
  assert.match(enhancement, /applyEditionLearnerLanguage\(root, context\)/);
  assert.match(enhancement, /learnerText\(before, context\.edition\)/);
});

test("the current School Edition corpus has explicit translations for its recurring high-load vocabulary", async () => {
  const language = (await source("lib/school-language.ts")).toLowerCase();
  const corpus = (await Promise.all(schoolHandbooks.map(decodeHandbook)))
    .flatMap((programme) => programme.treatment.pages.map((page) => plainText(page.html)))
    .join(" ")
    .toLowerCase();

  const present = highLoadTerms.filter((term) => corpus.includes(term));
  assert.ok(present.length >= 6, "The audit should exercise real high-load vocabulary in the school corpus.");

  for (const term of present) {
    assert.ok(language.includes(term), `School corpus term "${term}" is not covered by the language standard.`);
  }
});

test("learner Labs use edition language without changing staff terminology", async () => {
  const [habit, core, universal] = await Promise.all([
    source("app/bis-app.tsx"),
    source("app/core-lab-experience.tsx"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
  ]);

  assert.match(habit, /EditionLanguageScope edition=\{edition\} enabled=\{systemMode === "learner"\}/);
  assert.match(core, /EditionLanguageScope edition=\{edition\}/);
  assert.match(universal, /EditionLanguageScope edition=\{snapshot\.deliveryEdition\}/);
  assert.match(habit, /systemMode === "learner"/);
});

test("the Core Lab welcome uses participant-facing metadata for all three editions", async () => {
  const core = await source("app/core-lab-experience.tsx");

  assert.match(core, /School Edition/);
  assert.match(core, /Emerging Adult Edition/);
  assert.match(core, /Workplace Edition/);
  assert.match(core, /Ages 14–18 · No prior knowledge needed/);
  assert.match(core, /Ages 18–25 · Independent or facilitated/);
  assert.match(core, /Workplace participants · No prior BIS knowledge needed/);
  assert.doesNotMatch(core, /Price point/);
  assert.doesNotMatch(core, /Production Master · Version/);
});

test("key technical concepts are translated into plain meaning for school learners", async () => {
  const language = await source("lib/school-language.ts");

  const expected = [
    ["Falsification Test", "What would show this explanation is wrong?"],
    ["adherence rate", "how often you followed your plan"],
    ["calibration", "checking how close your prediction was"],
    ["provenance", "where the information came from"],
    ["diagnostic layer", "extra clues"],
    ["impact domains", "areas of your life"],
    ["Decision Deliberateness Rating", "How carefully you make decisions"],
    ["Agency Shift Indicator", "Change in your sense of control"],
    ["Synthesise", "Bring together"],
    ["cognitive load", "thinking effort"],
    ["Behaviour Evidence Indicator", "BIS measure"],
    ["baseline", "starting point"],
  ];

  for (const [technical, plain] of expected) {
    assert.ok(language.includes(technical), `Missing technical term: ${technical}`);
    assert.ok(language.includes(plain), `Missing learner-first wording: ${plain}`);
  }
});


test("school translations do not recursively rewrite the plain-language replacement", async () => {
  const language = await source("lib/school-language.ts");

  assert.match(language, /Falsification Test\\b\/gi, "What would show this explanation is wrong\?"/);
  assert.doesNotMatch(language, /wrong\? \(falsification test\)/);
});
