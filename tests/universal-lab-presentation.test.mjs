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

test("Universal runtime uses continuous digital prompt controls without workbook card numbering", async () => {
  const runtime = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.doesNotMatch(runtime, /String\(index\)\.padStart\(2, "0"\)/);
  assert.doesNotMatch(runtime, /className="prompt-number"/);
  assert.match(runtime, /answer-list universal-choice-list/);
  assert.match(runtime, /prepareUniversalLabPresentation/);
  assert.match(runtime, /You can choose “Prefer not to answer” for any question/);
  assert.doesNotMatch(runtime, /grounded in the BIS source workbook/i);
  assert.doesNotMatch(runtime, /corrections remain traceable\.<\/p>/i);
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
  assert.match(frame, /<h1 className="learner-document-title">\{canonicalTitle\}<\/h1>/);
  assert.doesNotMatch(frame, /canonicalStage\?\.role/);
  assert.doesNotMatch(frame, />□ \{output\}</);
});

test("learner shell keeps one centred Menu across Learn, Today and Lab", async () => {
  const [shell, css] = await Promise.all([
    source("app/canonical-adaptive-shell.tsx"),
    source("app/canonical-shell.css"),
  ]);
  assert.doesNotMatch(shell, /className="canonical-topbar-menu"/);
  assert.match(shell, /className="canonical-menu-trigger"/);
  assert.match(shell, /Open BIS menu · current area/);
  assert.match(css, /\.canonical-menu-trigger\{display:flex!important\}/);
  assert.doesNotMatch(css, /canonical-shell:not\(\[data-stage="lab"\]\) \.canonical-menu-trigger/);
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


test("Volume 3 Likert tables become a real pre-investigation baseline instead of static checkboxes", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [{
    id: "SYS.I1.PREDICTION",
    label: "Your prediction",
    prompt: "What do you think Myah will learn?",
    type: "TEXT",
    required: true,
  }];
  first.blocks = [
    {
      type: "HTML",
      html: "<h3>THINKING BASELINE — PRE</h3><p>Before you begin, complete this diagnostic.</p>"
        + "<table><tr><th>When you think about problems, how often do you...</th><th>Never</th><th>Rarely</th><th>Sometimes</th><th>Often</th><th>Always</th></tr>"
        + "<tr><td>Notice patterns repeating over time</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td></tr>"
        + "<tr><td>Ask why a problem keeps happening</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td><td>☐</td></tr></table>",
    },
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    { type: "PROMPT", promptId: "SYS.I1.PREDICTION" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  assert.ok(result.presentationBaseline);
  assert.equal(result.presentationBaseline.items.length, 2);
  assert.deepEqual(result.presentationBaseline.items[0].options, [
    "Never", "Rarely", "Sometimes", "Often", "Always",
  ]);
  assert.equal(result.presentationBaseline.items[0].label, "Notice patterns repeating over time");
  assert.equal(
    result.investigations[0].blocks.some((block) =>
      block.type === "HTML" && /Notice patterns repeating/.test(universalHtmlText(block.html))
    ),
    false,
    "baseline matrix must not remain as a static workbook table inside Investigation 1",
  );
});

test("experiment table checkbox choices become answer controls rather than printed checkbox text", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    {
      type: "HTML",
      html: "<table><tr><th>Day</th><th>Date</th><th>Moment I Noticed</th><th>Did I see the system?</th><th>Notes</th></tr>"
        + "<tr><td>1</td><td></td><td></td><td>☐ Yes ☐ No</td><td></td></tr>"
        + "<tr><td>2</td><td></td><td></td><td>☐ Yes ☐ No</td><td></td></tr></table>",
    },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  const table = investigation.blocks.find((block) => block.type === "TABLE");
  assert.ok(table);
  const choicePrompts = investigation.prompts.filter((prompt) => prompt.type === "BOOLEAN");
  assert.equal(choicePrompts.length, 2);
  assert.ok(choicePrompts.every((prompt) => /Did I see the system/.test(prompt.label)));
  assert.equal(
    table.rows.flatMap((row) => row).some((cell) => cell.kind === "TEXT" && /☐/.test(cell.text)),
    false,
  );
});

test("Likert compilation is domain-neutral so TEI baselines are first-class too", async () => {
  const adapter = await source("lib/content-source-adapters.ts");
  assert.match(adapter, /const likertOptions = \["never", "rarely", "sometimes", "often", "always"\]/);
  assert.match(adapter, /group: "Baseline"/);
  assert.doesNotMatch(adapter, /group: "Risk baseline"/);
});

test("Universal table renderer supports matrix choice cells and table selects", async () => {
  const [runtime, compiler] = await Promise.all([
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("lib/content-compiler.ts"),
  ]);
  assert.match(compiler, /kind: "CHOICE"/);
  assert.match(runtime, /cell\.kind === "CHOICE"/);
  assert.match(runtime, /role="radio"/);
  assert.match(runtime, /categoricalOptions/);
});


test("legacy The Prediction does not appear as a competing subtitle under canonical The Pattern", async () => {
  const frame = await source("app/lab-investigation-frame.tsx");
  assert.match(frame, /legacyPredictionTitle/);
  assert.match(frame, /!legacyPredictionTitle/);
});


test("already-published Labs receive current Pattern-stage evidence prompts at runtime", () => {
  const published = {
    kind: "LAB",
    schemaVersion: "universal-lab-v2",
    runtimeProfile: "UNIVERSAL_V2",
    identity: { code: "TIM", version: "1.0", title: "Time Lab", shortTitle: "Time Lab", accent: "#2f8276" },
    investigations: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      title: index === 1 ? "The Prediction" : `Stage ${index + 1}`,
      mission: "Investigate with evidence.",
      phase: "Investigation",
      time: "10 minutes",
      difficulty: "Observe",
      produces: [],
      blocks: [],
      prompts: index === 1 ? [{
        id: "TIM.I2.LEGACY",
        label: "Your prediction",
        prompt: "If you tracked your time for one day, where do you think most of it would go?",
        type: "TEXT",
        required: true,
        origin: "SOURCE",
      }] : [],
    })),
    indicatorRegistry: [],
    computedFields: [],
    experiment: null,
    profile: null,
  };

  const result = prepareUniversalLabPresentation(published);
  const pattern = result.investigations[1];
  const purposes = pattern.prompts.map((prompt) => prompt.standardPurpose).filter(Boolean);
  assert.ok(purposes.includes("PATTERN_TARGET"));
  assert.ok(purposes.includes("PATTERN_EVIDENCE"));
  assert.equal(pattern.standardStage?.key, "PATTERN");

  const twice = prepareUniversalLabPresentation(result);
  assert.equal(
    twice.investigations[1].prompts.filter((prompt) => prompt.standardPurpose === "PATTERN_TARGET").length,
    1,
  );
  assert.equal(
    twice.investigations[1].prompts.filter((prompt) => prompt.standardPurpose === "PATTERN_EVIDENCE").length,
    1,
  );
});

test("server and learner client share the same runtime presentation normalizer", async () => {
  const [api, runtime, presentation] = await Promise.all([
    source("app/api/universal-lab/route.ts"),
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("lib/universal-lab-presentation.mjs"),
  ]);
  assert.match(api, /prepareUniversalLabPresentation/);
  assert.match(runtime, /prepareUniversalLabPresentation/);
  assert.match(presentation, /applyHabitLabStandard/);
});

test("each investigation is one Learn-style document instead of a stack of cards", async () => {
  const [frame, css] = await Promise.all([
    source("app/lab-investigation-frame.tsx"),
    source("app/lab-investigation-frame.css"),
  ]);
  assert.match(frame, /className="universal-lab-document learner-document"/);
  assert.match(frame, /className="universal-lab-document-body learner-document-body"/);
  assert.match(frame, /id="lab-investigation-start"/);
  assert.match(css, /BIS Laboratory Reader v4/);
  assert.match(css, /\.universal-lab-document\{/);
  assert.match(css, /\.universal-package-lab \.universal-prompt\{/);
  assert.match(css, /border-top:1px solid #e2e6e3!important/);
  assert.match(css, /background:transparent!important/);
});

test("passed questions keep their input visible without repetitive skip prose", async () => {
  const runtime = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.match(runtime, /prompt-controls/);
  assert.match(runtime, /is-passed/);
  assert.doesNotMatch(runtime, /Skipped for now/);
  assert.doesNotMatch(runtime, /You chose not to answer this question/);
});

test("save validation appears only after the learner tries to continue", async () => {
  const runtime = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.match(runtime, /const \[attemptedSubmit, setAttemptedSubmit\] = useState\(false\)/);
  assert.match(runtime, /attemptedSubmit && !ready/);
  assert.match(runtime, /if \(!guardSave\(\)\) return/);
  assert.doesNotMatch(runtime, /Saved as private, traceable evidence/);
});

test("authored mapping activities are not duplicated by a generic generated Draw prompt", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [{
    id: "IDN.I4.MAP",
    label: "My Identity Map",
    prompt: "What belongs on your identity map?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  }];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    {
      type: "HTML",
      html: "<p>Step 1: Draw Your Identity Map</p><p>Draw yourself in the centre. Around you, draw circles for family, friends and school.</p>",
    },
    { type: "PROMPT", promptId: "IDN.I4.MAP" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  assert.equal(
    investigation.prompts.filter((prompt) => String(prompt.id).includes(".ACTION.")).length,
    0,
  );
  assert.equal(
    investigation.prompts.filter((prompt) => prompt.label === "My Identity Map").length,
    1,
  );
});

test("workbook section labels keep hierarchy while sentence blanks stay inside the sentence as controls", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    {
      type: "HTML",
      html: '<p>Your Personal Equation</p>'
        + '<p>Instructions: Each day, record ONE moment when you noticed the pattern.</p>'
        + '<p>My Commitment Statement</p>'
        + '<p>"I, ________________________________, commit to observing my identity for 7 days, starting on ___________ and ending on ___________. I understand that I will not be perfect."</p>'
        + '<p>"Right now I feel like someone who..."</p>'
        + '<p>Example Equations:</p>'
        + '<p>Final Reflection Questions</p>'
        + '<p>My Meta-Identity Skill</p>'
        + '<p>BEHAVIOUR PROFILE SUMMARY</p>',
    },
    { type: "PROMPT", promptId: "PEF.I1.Q1" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  const html = investigation.blocks
    .filter((block) => block.type === "HTML")
    .map((block) => block.html)
    .join("");
  const inline = investigation.blocks.find((block) => block.type === "INLINE");

  assert.ok((html.match(/bis-digital-section-heading/g) ?? []).length >= 5);
  assert.match(html, /bis-digital-instruction-panel/);
  assert.ok(inline, "the commitment sentence should be represented as an inline interaction block");
  const inlineIds = inline.segments.filter((segment) => segment.kind === "PROMPT").map((segment) => segment.promptId);
  assert.equal(inlineIds.length, 3);
  assert.deepEqual(
    inlineIds.map((id) => investigation.prompts.find((prompt) => prompt.id === id)?.label),
    ["Name", "Start date", "End date"],
  );
  assert.equal(
    investigation.prompts.some((prompt) => /commit to observing my identity for 7 days/i.test(prompt.label)),
    false,
    "the sentence must not be duplicated as a giant standalone textarea",
  );
  assert.ok(
    investigation.prompts.some((prompt) => prompt.label === "Today’s Insight"),
    "the reflection stem must be an input, not decorative prose",
  );
});

test("Universal Lab CSS permanently suppresses the obsolete side-number gutter", async () => {
  const [runtime, css] = await Promise.all([
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("app/lab-investigation-frame.css"),
  ]);
  assert.doesNotMatch(runtime, /className="prompt-number"/);
  assert.match(css, /\.universal-package-lab \.prompt-number\{\s*display:none!important/);
});


test("generic workbook response controls inherit the authored question instead of repeating it as prose", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [{
    id: "IDN.I5.CONFIDENCE",
    label: "Your response",
    prompt: "Your response",
    type: "INTEGER",
    min: 1,
    max: 10,
    required: true,
    origin: "SOURCE",
  }];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    { type: "HTML", html: '<p>"How confident are you that this equation explains your identity pattern?"</p>' },
    { type: "PROMPT", promptId: "IDN.I5.CONFIDENCE" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  const prompt = investigation.prompts.find((item) => item.id === "IDN.I5.CONFIDENCE");
  assert.equal(prompt?.label, "How confident are you that this equation explains your identity pattern?");
  assert.equal(
    investigation.blocks.some((block) =>
      block.type === "HTML" && /How confident are you/.test(universalHtmlText(block.html))
    ),
    false,
    "the question should exist once as the digital control, not as duplicated prose",
  );
});

test("Contract stage preserves every authored collection field as a learner control", () => {
  const sourceFixture = fixture();
  const base = sourceFixture.investigations[0];
  sourceFixture.investigations = Array.from({ length: 9 }, (_, index) => ({
    ...structuredClone(base),
    number: index + 1,
    title: `Stage ${index + 1}`,
    prompts: [],
    blocks: [{ type: "HTML", html: `<h3>INVESTIGATION ${index + 1} — STAGE</h3>` }],
  }));
  const contract = sourceFixture.investigations[5];
  contract.prompts = [
    { id: "IDN.I6.I", label: "I,", prompt: "I,", type: "TEXT", required: true, origin: "SOURCE" },
    { id: "IDN.I6.SIGNED", label: "Signed", prompt: "Signed", type: "TEXT", required: false, origin: "SOURCE" },
    { id: "IDN.I6.DATE", label: "Date", prompt: "Date", type: "DATE", required: false, origin: "SOURCE" },
    { id: "IDN.I6.RESTART", label: "My restart plan", prompt: "What will you do if you miss a day?", type: "TEXT", required: true, origin: "SOURCE" },
  ];
  contract.blocks.push(
    { type: "PROMPT", promptId: "IDN.I6.I" },
    { type: "PROMPT", promptId: "IDN.I6.SIGNED" },
    { type: "PROMPT", promptId: "IDN.I6.DATE" },
    { type: "PROMPT", promptId: "IDN.I6.RESTART" },
  );

  const result = prepareUniversalLabPresentation(sourceFixture);
  const prompts = result.investigations[5].prompts;
  for (const label of ["I,", "Signed", "Date", "My restart plan"]) {
    assert.ok(prompts.some((prompt) => prompt.label === label), `${label} must remain a digital control`);
  }
});


test("authored equations become compact digital formula objects", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    {
      type: "HTML",
      html: "<p>Your Personal Equation</p>"
        + "<p>Inherited Beliefs + Chosen Actions = Current Identity</p>"
        + "<p>Chosen Beliefs + Chosen Actions = Becoming Identity</p>",
    },
    { type: "PROMPT", promptId: "PEF.I1.Q1" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const html = result.investigations[0].blocks
    .filter((block) => block.type === "HTML")
    .map((block) => block.html)
    .join("");
  assert.equal((html.match(/bis-digital-equation/g) ?? []).length, 2);
  assert.match(universalHtmlText(html), /Inherited Beliefs \+ Chosen Actions = Current Identity/);
});


test("bounded confidence measures render as digital rating scales instead of number blanks", async () => {
  const [runtime, css] = await Promise.all([
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("app/lab-investigation-frame.css"),
  ]);
  assert.match(runtime, /const ratingScale =/);
  assert.match(runtime, /universal-rating-scale/);
  assert.match(runtime, /aria-pressed=/);
  assert.match(css, /\.universal-rating-options\{/);
  assert.match(css, /grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
});


test("presentation baseline collapses repeated source rows before the learner sees them", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  const options = ["Never", "Rarely", "Sometimes", "Often", "Always"];
  first.prompts.unshift(
    {
      id: "LDR.I1.BASELINE.ONE.A",
      label: "See yourself as a leader",
      prompt: "See yourself as a leader",
      type: "CATEGORICAL",
      options,
      required: true,
      group: "Baseline",
    },
    {
      id: "LDR.I1.BASELINE.ONE.B",
      label: "See yourself as a leader",
      prompt: "See yourself as a leader",
      type: "CATEGORICAL",
      options,
      required: true,
      group: "Baseline",
    },
    {
      id: "LDR.I1.BASELINE.TWO",
      label: "Take responsibility for outcomes",
      prompt: "Take responsibility for outcomes",
      type: "CATEGORICAL",
      options,
      required: true,
      group: "Baseline",
    },
  );
  first.blocks.unshift(
    { type: "HTML", html: "<h3>LEADERSHIP BASELINE — PRE</h3>" },
    { type: "HTML", html: "<p>Before you begin, complete this diagnostic.</p>" },
    { type: "PROMPT", promptId: "LDR.I1.BASELINE.ONE.A" },
    { type: "PROMPT", promptId: "LDR.I1.BASELINE.ONE.B" },
    { type: "PROMPT", promptId: "LDR.I1.BASELINE.TWO" },
  );

  const result = prepareUniversalLabPresentation(sourceFixture);
  assert.ok(result.presentationBaseline);
  assert.deepEqual(
    result.presentationBaseline.items.map((prompt) => prompt.label),
    ["See yourself as a leader", "Take responsibility for outcomes"],
  );
});

test("published workbook response stems become real controls even when the investigation already has authored prompts", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.blocks.push(
    { type: "HTML", html: "<p>Right now I feel like someone who...</p>" },
    { type: "HTML", html: "<p>✍️ ____________________________________</p>" },
    { type: "HTML", html: "<p>✍️ Leader I admire: ____________________________________</p>" },
    { type: "HTML", html: "<p>1.</p><p>2.</p><p>3.</p>" },
  );

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  const insight = investigation.prompts.find((prompt) => prompt.label === "Today’s Insight");
  assert.ok(insight);
  assert.equal(insight.type, "TEXT");
  assert.match(insight.prompt, /Right now I feel like someone who/);
  assert.ok(investigation.prompts.some((prompt) => prompt.label === "Leader I admire"));

  const scaffoldPrompts = investigation.prompts.filter((prompt) => String(prompt.id).includes(".SCAFFOLD."));
  assert.equal(scaffoldPrompts.length, 3, "the authored 1 / 2 / 3 writing spaces must become three controls");
  assert.deepEqual(
    scaffoldPrompts.map((prompt) => prompt.label),
    ["Leader I admire 1", "Leader I admire 2", "Leader I admire 3"],
  );

  const html = investigation.blocks
    .filter((block) => block.type === "HTML")
    .map((block) => block.html)
    .join("");
  assert.doesNotMatch(universalHtmlText(html), /^1\.\s*2\.\s*3\.$/);
  assert.doesNotMatch(universalHtmlText(html), /Leader I admire/);
});




test("a workbook field marker before 1 / 2 / 3 becomes the collection label, not a fourth response", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [{
    id: "LDR.I4.WHERE",
    label: "Where I lead",
    prompt: "Where I lead",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  }];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    { type: "HTML", html: "<p>List the places where you already lead—even without a title.</p>" },
    { type: "PROMPT", promptId: "LDR.I4.WHERE" },
    { type: "HTML", html: "<p>1.</p><p>2.</p><p>3.</p>" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const investigation = result.investigations[0];
  assert.equal(
    investigation.prompts.some((prompt) => prompt.id === "LDR.I4.WHERE"),
    false,
    "the marker is a heading for the list, not a separate response",
  );
  const entries = investigation.prompts.filter((prompt) => String(prompt.id).includes(".SCAFFOLD."));
  assert.equal(entries.length, 3);
  assert.deepEqual(entries.map((prompt) => prompt.label), [
    "Where I lead 1",
    "Where I lead 2",
    "Where I lead 3",
  ]);
});

test("presentation normalization is idempotent so server and client enforce the same prompt schema", () => {
  const once = prepareUniversalLabPresentation(fixture());
  const twice = prepareUniversalLabPresentation(once);
  assert.strictEqual(twice, once);
  assert.ok(once.presentationVersion);
  assert.deepEqual(
    twice.investigations.map((investigation) => investigation.prompts.map((prompt) => prompt.id)),
    once.investigations.map((investigation) => investigation.prompts.map((prompt) => prompt.id)),
  );
});

test("Pause and Ask yourself reflection becomes a required learner response", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.blocks.push(
    { type: "HTML", html: "<p>Close the workbook.</p>" },
    { type: "HTML", html: "<p>Take 30 seconds.</p>" },
    { type: "HTML", html: "<p>Ask yourself:</p>" },
    { type: "HTML", html: '<p>"What is one thing I now see that I did not see before?"</p>' },
    { type: "HTML", html: "<p>Then continue.</p>" },
  );

  const result = prepareUniversalLabPresentation(sourceFixture);
  const prompt = result.investigations[0].prompts.find((item) =>
    /What is one thing I now see that I did not see before/i.test(item.label),
  );
  assert.ok(prompt);
  assert.equal(prompt.required, true);
  assert.equal(prompt.group, "Pause reflection");
});

test("legacy text confidence prompts recover their authored 1-to-10 measurement scale", () => {
  const sourceFixture = fixture();
  const first = sourceFixture.investigations[0];
  first.prompts = [{
    id: "LDR.I5.CONFIDENCE",
    label: "How confident are you that this equation explains your leadership pattern?",
    prompt: "How confident are you that this equation explains your leadership pattern?",
    type: "TEXT",
    required: true,
    origin: "SOURCE",
  }];
  first.blocks = [
    { type: "HTML", html: "<h3>INVESTIGATION 1 — THE HOOK</h3>" },
    { type: "PROMPT", promptId: "LDR.I5.CONFIDENCE" },
  ];

  const result = prepareUniversalLabPresentation(sourceFixture);
  const prompt = result.investigations[0].prompts[0];
  assert.equal(prompt.type, "INTEGER");
  assert.equal(prompt.min, 1);
  assert.equal(prompt.max, 10);
});

test("runtime groups numbered writing scaffolds and renders sentence blanks inline", async () => {
  const [runtime, css] = await Promise.all([
    source("app/labs/[code]/universal-runtime-lab.tsx"),
    source("app/lab-investigation-frame.css"),
  ]);
  assert.match(runtime, /UniversalPromptCollection/);
  assert.match(runtime, /UniversalInlineResponse/);
  assert.match(runtime, /relatedLabels/);
  assert.match(runtime, /block\.visibility === "AFTER_EXPERIMENT"/);
  assert.match(css, /\.universal-prompt-collection\{/);
  assert.match(css, /\.universal-inline-response\{/);
  assert.match(css, /\.universal-inline-input/);
});

test("already-published legacy daily trackers regain Day N scheduling without re-uploading the Lab", () => {
  const investigations = Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    title: `Stage ${index + 1}`,
    mission: "Investigate the evidence.",
    produces: [],
    prompts: [],
    blocks: [],
  }));
  investigations[6] = {
    ...investigations[6],
    title: "7-Day Experiment",
    prompts: [
      { id: "LDR.I7.D1.DATE", label: "Date", prompt: "Date — 1", type: "TEXT", required: true, group: "1" },
      { id: "LDR.I7.D1.MOMENT", label: "Moment I Noticed", prompt: "Moment I Noticed — 1", type: "TEXT", required: true, group: "1" },
      { id: "LDR.I7.D1.ACT", label: "Did I act?", prompt: "Did I act? — 1", type: "TEXT", required: true, group: "1" },
      { id: "LDR.I7.D1.NOTES", label: "Notes", prompt: "Notes — 1", type: "TEXT", required: true, group: "1" },
      { id: "LDR.I7.D2.DATE", label: "Date", prompt: "Date — 2", type: "TEXT", required: true, group: "2" },
      { id: "LDR.I7.D2.MOMENT", label: "Moment I Noticed", prompt: "Moment I Noticed — 2", type: "TEXT", required: true, group: "2" },
      { id: "LDR.I7.D2.ACT", label: "Did I act?", prompt: "Did I act? — 2", type: "TEXT", required: true, group: "2" },
      { id: "LDR.I7.D2.NOTES", label: "Notes", prompt: "Notes — 2", type: "TEXT", required: true, group: "2" },
    ],
    blocks: [
      { type: "PROMPT", promptId: "LDR.I7.D1.DATE" },
      { type: "PROMPT", promptId: "LDR.I7.D1.MOMENT" },
      { type: "PROMPT", promptId: "LDR.I7.D1.ACT" },
      { type: "PROMPT", promptId: "LDR.I7.D1.NOTES" },
      { type: "PROMPT", promptId: "LDR.I7.D2.DATE" },
      { type: "PROMPT", promptId: "LDR.I7.D2.MOMENT" },
      { type: "PROMPT", promptId: "LDR.I7.D2.ACT" },
      { type: "PROMPT", promptId: "LDR.I7.D2.NOTES" },
    ],
  };

  const sourceFixture = {
    kind: "LAB",
    schemaVersion: "universal-lab-v2",
    runtimeProfile: "UNIVERSAL_V2",
    identity: { code: "LDR", version: "1.0", title: "Leadership Lab", shortTitle: "Leadership Lab", accent: "#2f8276" },
    investigations,
    experiment: {
      investigation: 7,
      startAfterInvestigation: 6,
      days: 7,
      reviewInvestigation: 8,
      scheduledPromptIds: [],
    },
    indicatorRegistry: [],
    computedFields: [],
    profile: null,
  };

  const result = prepareUniversalLabPresentation(sourceFixture);
  const tracking = result.investigations.find((item) => item.number === 7).prompts;
  assert.equal(tracking.filter((prompt) => prompt.group === "Day 1").length, 4);
  assert.equal(tracking.filter((prompt) => prompt.group === "Day 2").length, 4);
  assert.ok(tracking.some((prompt) => prompt.label === "Day 1 evidence" && prompt.scheduleDay === 1));
  assert.ok(tracking.some((prompt) => prompt.label === "Day 1 action check" && prompt.type === "BOOLEAN"));
  assert.ok(tracking.some((prompt) => prompt.label === "Day 1 notes" && prompt.required === false));
  assert.equal(result.experiment.scheduledPromptIds.length, 8);
});


test("baseline index cannot be silently saved at the minimum without a learner choice", async () => {
  const runtime = await source("app/labs/[code]/universal-runtime-lab.tsx");
  assert.match(runtime, /metricValue !== null/);
  assert.match(runtime, /const initialMetric = savedMetricValue === "" \? null : Number\(savedMetricValue\)/);
  assert.match(runtime, /onClick=\{\(\) => setMetricValue\(option\)\}/);
  assert.doesNotMatch(runtime, /Number\(valueOf\(snapshot, metric\.id\) \|\| metric\.min/);
});
