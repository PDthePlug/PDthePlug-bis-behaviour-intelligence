import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  prepareUniversalLabPresentation,
  universalHtmlText,
} from "../lib/universal-lab-presentation.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function fixture() {
  return {
    kind: "LAB",
    runtimeProfile: "UNIVERSAL_V2",
    identity: { code: "PEF", version: "1.0", title: "Personal Effectiveness Lab" },
    investigations: [{
      number: 1,
      title: "of 9",
      mission: "Meet someone who discovered that running yourself is a skill.",
      prompts: [
        {
          id: "PEF.I1.Q1",
          label: "What do you think Myah will learn about personal effectiveness?",
          prompt: "What do you think Myah will learn about personal effectiveness?",
          type: "TEXT",
          required: true,
          group: "Predict",
        },
        {
          id: "PEF.I1.Q1.ANSWER",
          label: "My prediction",
          prompt: "What do you think Myah will learn about personal effectiveness?",
          type: "TEXT",
          required: true,
          group: "Predict",
        },
        {
          id: "PEF.I1.STANDARD",
          label: "Your prediction",
          prompt: "Before the principle is explained, what do you think is happening here?",
          type: "TEXT",
          required: true,
          origin: "BIS_STANDARD",
          group: "BIS Laboratory Standard",
        },
      ],
      blocks: [
        { type: "HTML", html: "<h3>BEHAVIOUR EVIDENCE INDICATOR (BEI) SYSTEM</h3>" },
        { type: "HTML", html: "<p>Page 1</p>" },
        { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
        { type: "HTML", html: "<p>■□□□□□□□□ 1/9</p>" },
        { type: "HTML", html: "<p>MISSION: Meet someone who discovered that running yourself is a skill.</p>" },
        { type: "HTML", html: "<p>YOU WILL PRODUCE:</p>" },
        { type: "HTML", html: "<p>☐ A prediction about personal effectiveness</p>" },
        { type: "HTML", html: "<p>TIME: 5 minutes</p>" },
        { type: "HTML", html: "<p>DIFFICULTY: 🟢 Observe</p>" },
        { type: "HTML", html: "<h4>📖 Read</h4>" },
        { type: "HTML", html: "<p>Episode 1: The Girl Who Tried to Do Everything</p>" },
        { type: "HTML", html: "<p>Myah is overwhelmed.</p>" },
        { type: "HTML", html: "<h4>🤔 Predict</h4>" },
        { type: "HTML", html: "<p>&quot;What do you think Myah will learn about personal effectiveness?&quot;</p>" },
        { type: "PROMPT", promptId: "PEF.I1.Q1" },
        { type: "HTML", html: "<p>✍️ My prediction:</p>" },
        { type: "PROMPT", promptId: "PEF.I1.Q1.ANSWER" },
        { type: "HTML", html: "<p>☐ Work harder ☐ Use energy, focus and systems ☐ Give up</p>" },
      ],
    }],
    indicatorRegistry: [],
    computedFields: [],
    experiment: null,
    profile: null,
  };
}

test("presentation normalizer removes workbook chrome and groups narrative content", () => {
  const result = prepareUniversalLabPresentation(fixture());
  const investigation = result.investigations[0];

  assert.equal(investigation.blocks.filter((block) => block.type === "HTML").length, 1);
  const html = investigation.blocks.find((block) => block.type === "HTML")?.html ?? "";
  const text = universalHtmlText(html);
  assert.match(text, /Episode 1/);
  assert.match(text, /Myah is overwhelmed/);
  assert.doesNotMatch(text, /BEHAVIOUR EVIDENCE INDICATOR/);
  assert.doesNotMatch(text, /MISSION:/);
  assert.doesNotMatch(text, /TIME:/);
  assert.doesNotMatch(text, /DIFFICULTY:/);
});

test("duplicate authored questions collapse to one learner control and checkbox options become choices", () => {
  const result = prepareUniversalLabPresentation(fixture());
  const investigation = result.investigations[0];
  const sourcePrompts = investigation.prompts.filter((prompt) => prompt.origin !== "BIS_STANDARD");
  assert.equal(sourcePrompts.length, 1);
  assert.equal(sourcePrompts[0].type, "CATEGORICAL");
  assert.deepEqual(sourcePrompts[0].options, [
    "Work harder",
    "Use energy, focus and systems",
    "Give up",
  ]);
  assert.equal(
    investigation.blocks.filter((block) => block.type === "PROMPT").length,
    2,
    "one authored control plus the standard prediction control",
  );
});

test("dynamic Lab route owns only one canonical shell", async () => {
  const [parentLayout, routeLayout] = await Promise.all([
    source("app/labs/layout.tsx"),
    source("app/labs/[code]/layout.tsx"),
  ]);
  assert.match(parentLayout, /CanonicalAdaptiveShell/);
  assert.doesNotMatch(routeLayout, /CanonicalAdaptiveShell/);
});

test("Universal runtime uses numbered Habit-style prompt controls and choice buttons", async () => {
  const runtime = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.match(runtime, /String\(index\)\.padStart\(2, "0"\)/);
  assert.match(runtime, /answer-list universal-choice-list/);
  assert.match(runtime, /prepareUniversalLabPresentation/);
  assert.match(runtime, /same nine-investigation BIS method as Habit Lab/);
});
