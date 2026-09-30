import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const handbookRoot = new URL("../public/handbooks/v1/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", handbookRoot), "utf8"));
const source = (path) => readFile(new URL(path, root), "utf8");

const decode = async (asset) => {
  const raw = await readFile(new URL(asset, handbookRoot), "utf8");
  return JSON.parse(gunzipSync(Buffer.from(raw.trim(), "base64")).toString("utf8"));
};

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function count(re, value) {
  return [...value.matchAll(re)].length;
}

function metrics(page) {
  const text = strip(page.html);
  return {
    words: text ? text.split(/\s+/).filter(Boolean).length : 0,
    questions: count(/\?/g, text),
    controls: count(/<(?:textarea|input|select)\b/gi, page.html),
  };
}

test("all live programme days retain sufficient authored substance", async () => {
  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    for (const page of programme.treatment.pages) {
      if (!page.programmeDay) continue;
      const m = metrics(page);
      assert.ok(m.words >= 450, `${item.code} ${item.edition} ${page.key}: only ${m.words} words`);
      assert.ok(m.questions >= 10, `${item.code} ${item.edition} ${page.key}: only ${m.questions} questions`);
      assert.ok(m.controls >= 8, `${item.code} ${item.edition} ${page.key}: only ${m.controls} response controls`);
    }
  }
});

test("BIS learning sessions are 45 minutes and Lab Phase A remains a separate 90-minute experience", async () => {
  const [design, player] = await Promise.all([
    source("lib/session-design.ts"),
    source("app/learning/programme-player.tsx"),
  ]);

  assert.match(design, /BIS_LEARNING_SESSION_MINUTES = 45/);
  assert.match(design, /BIS_LAB_PHASE_A_MINUTES = 90/);
  assert.match(player, /Today’s learning session/);
  assert.match(player, /live Lab Phase A is separate from this learning session/);
});

test("the ten programme days use a deliberate learning arc rather than equal chapter density", async () => {
  const designSource = await source("lib/session-design.ts");
  const compiled = ts.transpileModule(designSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

  const expectedPurpose = [
    "Create relevance and introduce the problem",
    "Build the first mental model",
    "Prepare for the Lab handover",
    "Interpret what the Lab revealed",
    "Build the learner's personal model",
    "Apply the model in real life",
    "Diagnose what happened",
    "Introduce the final major conceptual layer",
    "Integrate the whole model",
    "Demonstrate change and transfer forward",
  ];
  const expectedChecks = [3, 3, 2, 4, 3, 2, 2, 4, 2, 2];

  for (let day = 1; day <= 10; day += 1) {
    const session = module.sessionDesignForPage({
      programmeDay: day,
      html: "<p>" + "learning ".repeat(day === 4 ? 2100 : 800) + "</p>",
    });
    assert.equal(session.minutes, 45);
    assert.equal(session.dayPurpose, expectedPurpose[day - 1]);
    assert.equal(session.checkTarget, expectedChecks[day - 1]);
    assert.ok(session.checkTarget >= 2 && session.checkTarget <= 4);
    assert.equal(session.beats.reduce((sum, beat) => sum + beat.minutes, 0), 45);
    assert.ok(session.learnerOutcome.length > 20);
    assert.ok(session.readingTreatment.length > 40);
  }

  assert.equal(module.sessionDesignForPage({ programmeDay: 6, html: "<p>short</p>" }).learningLoad.reading, "low");
  assert.equal(module.sessionDesignForPage({ programmeDay: 7, html: "<p>short</p>" }).learningLoad.application, "high");
  assert.equal(module.sessionDesignForPage({ programmeDay: 9, html: "<p>short</p>" }).density, "application");
  assert.equal(module.sessionDesignForPage({ programmeDay: 10, html: "<p>short</p>" }).learningLoad.evidence, "high");
});

test("handbooks interleave 2–4 purpose-labelled formative checks before the end checkpoint", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");

  assert.match(enhancement, /context\.formativeCheckTarget \?\? 3/);
  assert.match(enhancement, /Math\.max\(2, Math\.min\(4,/);
  assert.match(enhancement, /endCheckpointQuestions = new Set\(checkpointQuestionElements\(root\)\)/);
  for (const kind of ["RECALL", "UNDERSTAND", "DISTINGUISH", "PREDICT", "APPLY", "CHALLENGE", "CONFIDENCE"]) {
    assert.ok(enhancement.includes(kind), `Missing formative check kind: ${kind}`);
  }
  assert.match(enhancement, /This is for learning, not a mark or BEI score/);
  assert.match(enhancement, /FORMATIVE_CHECK/);
});

test("formative support signals are explicit and remain separate from BEI scoring", async () => {
  const [enhancement, player, migration] = await Promise.all([
    source("app/learning/handbook-document-enhancements.ts"),
    source("app/learning/programme-player.tsx"),
    source("supabase/migrations/20260930223000_learning_check_analytics.sql"),
  ]);

  for (const signal of ["UNDERSTOOD", "UNSURE", "NEEDS_EXAMPLE"]) {
    assert.ok(enhancement.includes(signal), `Missing learner support signal: ${signal}`);
  }
  assert.match(enhancement, /FORMATIVE_SIGNAL/);
  assert.match(enhancement, /WB\.CHECK/);
  assert.match(player, /purpose: target\.dataset\.purpose/);
  assert.match(player, /checkId: target\.dataset\.checkId/);
  assert.match(player, /checkKind: target\.dataset\.checkKind/);
  assert.match(migration, /excludedFromBEI', true/);
  assert.match(migration, /not marks, BEI evidence, psychometric scores/);
  assert.match(migration, /Never returns private workbook response text/);
});

test("formative response metadata survives the atomic workbook save queue", async () => {
  const queue = await source("lib/workbook-save-queue.ts");
  for (const field of ["purpose", "checkId", "checkKind", "privacyClass"]) {
    assert.ok(queue.includes(field), `Workbook queue drops ${field}`);
  }
  assert.match(queue, /semanticFieldId/);
  assert.match(queue, /semanticStepId/);
  assert.match(queue, /sourceFieldKey/);
});

test("facilitator and sponsor analytics only expose aggregate learning-check signals", async () => {
  const [staff, facilitator, sponsor] = await Promise.all([
    source("app/api/staff/route.ts"),
    source("app/facilitator-workspace.tsx"),
    source("app/programme-outcomes-view.tsx"),
  ]);

  assert.match(staff, /facilitator_cohort_learning_checks/);
  assert.match(staff, /sponsor_cohort_learning_checks/);
  assert.match(staff, /Learning checks/);
  assert.match(facilitator, /Where learners want more support/);
  assert.match(facilitator, /not marks and do not change BEI results/);
  assert.match(sponsor, /anonymous, learner-reported understanding signals/);
  assert.match(sponsor, /not marks and do not change BEI results/);
});
