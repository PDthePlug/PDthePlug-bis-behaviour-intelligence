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
  assert.match(parentLayout, /import \{ CanonicalAdaptiveShell \}/);
  assert.match(parentLayout, /<CanonicalAdaptiveShell>/);
  assert.doesNotMatch(routeLayout, /import \{ CanonicalAdaptiveShell \}/);
  assert.doesNotMatch(routeLayout, /<CanonicalAdaptiveShell>/);
});

test("Universal runtime uses numbered Habit-style prompt controls and choice buttons", async () => {
  const runtime = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.match(runtime, /String\(index\)\.padStart\(2, "0"\)/);
  assert.match(runtime, /answer-list universal-choice-list/);
  assert.match(runtime, /prepareUniversalLabPresentation/);
  assert.match(runtime, /same nine-investigation BIS method as Habit Lab/);
});


test("Volume 1 source baseline is preserved as a dedicated pre-investigation model", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts.unshift(
    {
      id: "PEF.I1.BASELINE.ONE",
      label: "Know where your effort goes",
      prompt: "Know where your effort goes",
      type: "CATEGORICAL",
      options: ["**Never**", "**Rarely**", "**Sometimes**", "**Often**", "**Always**"],
      required: true,
      group: "Baseline",
    },
    {
      id: "PEF.I1.BEI_01_PRE",
      label: "BEI-01-Pre",
      prompt: "How much control do you feel you have over your effectiveness?",
      type: "INTEGER",
      min: 1,
      max: 10,
      required: true,
      group: "PERSONAL EFFECTIVENESS BASELINE — PRE",
    },
  );
  first.blocks.unshift(
    { type: "HTML", html: "<h3>PERSONAL EFFECTIVENESS BASELINE — PRE</h3>" },
    { type: "HTML", html: "<p>Before you begin, complete this diagnostic. Be honest.</p>" },
    { type: "PROMPT", promptId: "PEF.I1.BASELINE.ONE" },
    { type: "PROMPT", promptId: "PEF.I1.BEI_01_PRE" },
  );

  const result = prepareUniversalLabPresentation(sourceFixture);
  assert.ok(result.presentationBaseline);
  assert.equal(result.presentationBaseline.items.length, 1);
  assert.deepEqual(result.presentationBaseline.items[0].options, [
    "Never",
    "Rarely",
    "Sometimes",
    "Often",
    "Always",
  ]);
  assert.equal(result.presentationBaseline.metric.id, "PEF.I1.BEI_01_PRE");
  assert.equal(
    result.investigations[0].prompts.some((prompt) => prompt.id === "PEF.I1.BASELINE.ONE"),
    false,
    "baseline controls must not leak into Investigation 1",
  );
});

test("Universal runtime saves baseline as investigation zero without unlocking past Investigation 1", async () => {
  const [api, runtime] = await Promise.all([
    source("app/api/universal-lab/route.ts"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
  ]);
  assert.match(api, /baselinePrompts\(definition/);
  assert.match(api, /investigation === 0/);
  assert.match(api, /UNIVERSAL_LAB_BASELINE_SAVED/);
  assert.match(api, /investigation === 0 \? 1 : investigationUnlockedAfterSave/);
  assert.match(runtime, /Create your starting point\./);
  assert.match(runtime, /investigation: 0/);
  assert.match(runtime, /presentationBaseline/);
});


test("TEI prediction metadata never becomes a learner answer and duplicate check collapses", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [
    {
      id: "SYS.I3.HUMAN",
      label: "Was your prediction correct?",
      prompt: "Was your prediction correct?",
      type: "CATEGORICAL",
      options: ["TEI-03: Prediction prediction-to-outcome check Score:", "Correct", "Incorrect"],
      required: true,
      group: "Were you correct?",
    },
    {
      id: "SYS.I3.TEI03",
      label: "TEI-03: Prediction prediction-to-outcome check Score",
      prompt: "TEI-03: Prediction prediction-to-outcome check Score:",
      type: "CATEGORICAL",
      options: ["Correct", "Incorrect"],
      required: true,
      group: "Were you correct?",
    },
  ];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    { type: "PROMPT", promptId: "SYS.I3.HUMAN" },
    { type: "PROMPT", promptId: "SYS.I3.TEI03" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const prompts = result.investigations[0].prompts;
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].prompt, "Was your prediction correct?");
  assert.deepEqual(prompts[0].options, ["Correct", "Incorrect"]);
  assert.equal(prompts.flatMap((prompt) => prompt.options ?? []).some((option) => /^TEI-03/.test(option)), false);
});

test("workbook blank tables become native evidence tables with real prompt cells", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [{
    id: "TIM.I2.NOTICE",
    label: "What did you notice?",
    prompt: "What did you notice?",
    type: "TEXT",
    required: true,
  }];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    {
      type: "HTML",
      html: "<table><tr><th>**Day**</th><th>**Planned**</th><th>**Actual**</th></tr><tr><td>Day 1</td><td>_____</td><td>_____</td></tr><tr><td>Day 2</td><td>_____</td><td>_____</td></tr><tr><td>Day 3</td><td>_____</td><td>_____</td></tr></table>",
    },
    { type: "PROMPT", promptId: "TIM.I2.NOTICE" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  const table = investigation.blocks.find((block) => block.type === "TABLE");
  assert.ok(table);
  assert.deepEqual(table.headers, ["Day", "Planned", "Actual"]);
  assert.equal(table.rows.length, 3);
  assert.equal(
    table.rows.flatMap((row) => row).filter((cell) => cell.kind === "PROMPT").length,
    6,
  );
  assert.equal(investigation.prompts.filter((prompt) => /Planned|Actual/.test(prompt.label)).length, 6);
});

test("produced outputs are not repeated inside imported source prose", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.produces = [
    "Understanding of time as attention",
    "Prediction prediction-to-outcome check check",
  ];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    {
      type: "HTML",
      html: "<p>☐ Understanding of time as attention</p><p>☐ Prediction prediction-to-outcome check check</p><p>Episode 2: What Myah Couldn't Fix</p>",
    },
    { type: "PROMPT", promptId: "PEF.I1.Q1" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  const html = investigation.blocks.filter((block) => block.type === "HTML").map((block) => block.html).join("");
  assert.doesNotMatch(universalHtmlText(html), /Understanding of time as attention/);
  assert.doesNotMatch(universalHtmlText(html), /prediction-to-outcome check/i);
  assert.match(universalHtmlText(html), /Episode 2/);
  assert.deepEqual(investigation.produces, [
    "Understanding of time as attention",
    "A check of your original prediction",
  ]);
});

test("learner frame shows the canonical nine-stage journey without internal facilitation instructions", async () => {
  const frame = await source("app/lab-investigation-frame.tsx");
  assert.match(frame, /<h1>{canonicalTitle}<\/h1>/);
  assert.doesNotMatch(frame, /canonicalStage\?\.role/);
  assert.doesNotMatch(frame, />□ \{output\}</);
});

test("BIS menu lives in the top app bar and no longer overlays evidence", async () => {
  const [shell, css] = await Promise.all([
    source("app/canonical-adaptive-shell.tsx"),
    source("app/canonical-shell.css"),
  ]);
  assert.match(shell, /className="canonical-topbar-menu"/);
  assert.doesNotMatch(shell, /className="canonical-menu-trigger"/);
  assert.match(css, /\.canonical-menu-trigger\{display:none!important\}/);
});

test("Volume 3 TEI codes are first-class evidence indicators", async () => {
  const [adapter, capabilities, v2] = await Promise.all([
    source("lib/content-source-adapters.ts"),
    source("lib/lab-factory-capabilities.mjs"),
    source("lib/universal-lab-v2.mjs"),
  ]);
  assert.match(adapter, /BEI\\|TEI/);
  assert.match(capabilities, /BEI\\|TEI/);
  assert.match(v2, /bei\\|tei/);
});
