import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";

async function adapterModule() {
  return loadContentTools();
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value >>> 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function storedZip(name, value) {
  const fileName = Buffer.from(name);
  const data = Buffer.from(value);
  const local = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(0), u32(data.length), u32(data.length), u16(fileName.length), u16(0),
    fileName, data,
  ]);
  const central = Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(0), u32(data.length), u32(data.length), u16(fileName.length), u16(0), u16(0),
    u16(0), u16(0), u32(0), u32(0), fileName,
  ]);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(1), u16(1),
    u32(central.length), u32(local.length), u16(0),
  ]);
  return new Uint8Array(Buffer.concat([local, central, eocd]));
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paragraph(value) {
  const lines = Array.isArray(value) ? value : [value];
  const body = lines.map((line, index) =>
    (index ? "<w:br/>" : "") + "<w:t>" + xmlEscape(line) + "</w:t>",
  ).join("");
  return "<w:p><w:r>" + body + "</w:r></w:p>";
}

function riskStyleHandbookDocx() {
  const blocks = [
    "RISK LAB™",
    "School Edition",
    "The Risk Investigation Handbook",
    "Applied Commerce®",
    "Behaviour Intelligence Series™",
    "Volume 1 — Handbook 7",
    "WELCOME",
    "Dear Learner,",
    "You are about to begin a 10-day investigation.",
    ["YOUR 10-DAY MAP", "Day 1 — Seeing Protection", "Day 3 — Risk Lab Phase A", "Day 10 — Integration"],
    "DAY 1 OF 10",
    "Concept Studio 1 — Seeing Protection",
    "💭 Pause and Reflect",
    "What was the situation?",
    "Was your protection coverage matched to what you intended, incomplete, additional, or unclear?",
    "☐ Matched",
    "☐ Incomplete",
    "☐ Additional",
    "☐ Unclear",
    "✅ Checkpoint",
    "1. What is a risk?",
    "2. Is a risk the same as a bad outcome?",
    "Answers:",
    "1. Risk is possibility under uncertainty.",
    "2. No.",
    "DAY 2 OF 10",
    "Concept Studio 2 — Thinking Like an Investigator",
    "✍️ Activity 1: Test Your Memory",
    "What I chose to check (generic description only):",
    "What I remember:",
    "What the record actually shows (generic status only — do not record passwords, codes, or account identifiers):",
    "How close was my memory to the record?",
    "✍️ Activity 2: Separate Observation from Interpretation",
    "Observation — what actually happened:",
    "Interpretation — what meaning you gave it:",
    "What else could the observation mean?",
    "DAY 3 OF 10",
    "Risk Lab — Phase A",
    [
      "SESSION: Risk Lab — Phase A",
      "TIME: 90 minutes",
      "MODE: Facilitated",
      "EXPERIMENT POSITION:",
      "Day 1 of 7 begins when this session ends.",
    ],
    "📖 Step 1 — Name the Pattern",
    "The protection pattern I want to investigate:",
    "Why I chose this one:",
    "📖 Step 3 — The Intended Protection Position",
    "What do you intend your protection to be?",
    "My intended protection position:",
    "📖 Step 6 — The Observable Protection Criterion",
    "What will I observe after the opportunity that tells me whether the action was in place?",
    "My Observable Protection Criterion:",
    "I will count the protection criterion as OCCURRED when:",
    "📖 Step 7 — My Current Equation",
    "My Working Risk Equation:",
    "Confidence:",
    "1 — 2 — 3 — 4 — 5 — 6 — 7 — 8 — 9 — 10",
    "📖 Step 8 — Awareness Baseline — Before the Experiment",
    "On a scale of 1–10, how aware are you of the difference between what you intend to protect against and what is actually in place?",
    "1 — 2 — 3 — 4 — 5 — 6 — 7 — 8 — 9 — 10",
    "My rating: ___ /10",
    "My Risk Check (what I will do when I notice an eligible protection opportunity):",
    "Identify the target opportunity → Record intended protection position → Record actual protection position.",
    "My minimum Risk Check (the smallest version that still counts):",
    "Identify the target opportunity → Record intended protection position → Record actual protection position at the start.",
    "My target condition (time, place, type of risk, type of moment):",
    "When your target context occurs and your Protective Action is implemented, how often do you predict the observable protection criterion will occur?",
    "________ %",
    "DAY 4 OF 10",
    "Concept Studio 3 — Understanding the Pattern",
    "✍️ Activity: Deepen Your Understanding",
    "Risk Context: _______________________________________________",
    "What surprised you? _________________________________________",
    "DAY 5 OF 10",
    "Evidence Studio + Day 3 Checkpoint",
    ["Element What Happened", "Time / context", "Risk context", "Protective Action", "Observed Protection State"],
    "WEEKEND",
    "Field Experiment",
    "Keep tracking. Do not create an opportunity just to produce evidence.",
    "DAY 6 OF 10",
    "Experiment Clinic",
    "What needs adjusting?",
    "DAY 7 OF 10",
    "Final Field Application",
    ["Element What Was Recorded", "Intended Protection Position", "Actual Protection Position at start", "Protective Action", "Observed Protection State"],
    "⚡ Micro-Execution",
    "Write down the ONE thing you learned from the experiment.",
    "DAY 8 OF 10",
    "Evidence Review",
    "Observation days completed: _______ / 7",
    "Missing / unrecorded days: _______ / 7",
    "Eligible target opportunities observed: _______",
    "Checks initiated (Minimum or Full): _______",
    "Risk Check Initiation Rate: _______ %",
    "Full Checks completed: _______",
    "Minimum Checks completed: _______",
    "Opportunity coverage: _______",
    "Completed Risk Checks: _______",
    "Usable events for prediction testing: _______ / _______",
    "Protection criterion occurred in these events: _______",
    "Predicted Protection Criterion Rate: _______ %",
    "DAY 9 OF 10",
    "Concept Studio 4 — Transfer & Meta-Risk",
    "Which one would you investigate next?",
    "DAY 10 OF 10",
    "Integration & Next Bridge",
    "📖 My Risk Investigation Profile",
    ["Element My Answer", "Protection Pattern Investigated", "Risk Context", "Working Equation", "Next Protection Pattern to Investigate"],
    "📖 One Sentence",
    "What I can now do:",
    "💭 Letter to My Future Self",
    "Dear Future Me,",
    "From me, in Grade ___",
    "Date: _______________",
    "RISK INVESTIGATION CERTIFICATE",
    "This certifies that the learner completed the investigation.",
    "Facilitator: ______________________",
    "Date: ______________________",
    "Workbook ID: ______________________",
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    blocks.map(paragraph).join("") +
    "</w:body></w:document>";
  return storedZip("word/document.xml", xml);
}

async function compiledRiskProgramme() {
  const tools = await adapterModule();
  try {
  const bytes = await tools.adaptLearningSource(
    riskStyleHandbookDocx(),
    "DOCX",
    "RSK",
    "1.0-S",
    "school",
    { title: "Risk Lab™ Learning Module", slug: "risk" },
  );
  return JSON.parse(new TextDecoder().decode(bytes));
  } finally { await tools.dispose(); }
}

test("Risk-style Word source resolves to the canonical BIS 13-position handbook", async () => {
  const programme = await compiledRiskProgramme();

  assert.equal(programme.identity.code, "RSK");
  assert.equal(programme.edition, "school");
  assert.equal(programme.identity.subtitle, "The Risk Investigation Handbook");
  assert.deepEqual(
    programme.treatment.pages.map((page) => page.key),
    ["Welcome","Day 1","Day 2","Day 3","Day 4","Day 5","Weekend","Day 6","Day 7","Day 8","Day 9","Day 10","Certificate"],
  );
  assert.equal(programme.treatment.pages.find((page) => page.key === "Day 1").label, "Concept Studio 1 — Seeing Protection");
  assert.equal(programme.treatment.pages.find((page) => page.key === "Day 3").label, "Risk Lab — Phase A");
  assert.match(programme.treatment.pages.find((page) => page.key === "Day 3").experimentPosition, /Day 1 of 7/);
  assert.match(programme.treatment.pages.find((page) => page.key === "Certificate").label, /RISK INVESTIGATION CERTIFICATE/);
});

test("Risk-style handbook activities become saved learner controls while checkpoint answers stay authored content", async () => {
  const programme = await compiledRiskProgramme();
  const page = (key) => programme.treatment.pages.find((candidate) => candidate.key === key).html;
  const day1 = page("Day 1");
  const day2 = page("Day 2");
  const day3 = page("Day 3");
  const day5 = page("Day 5");
  const day7 = page("Day 7");
  const day8 = page("Day 8");
  const day10 = page("Day 10");

  assert.match(day1, /<select[^>]+data-source-key=/);
  assert.match(day1, /<textarea[^>]+data-source-key=/);
  assert.match(day1, /Answers:/);
  assert.equal((day1.match(/Risk is possibility under uncertainty\./g) ?? []).length, 1);

  for (const label of [
    "What I chose to check",
    "What the record actually shows",
    "Observation — what actually happened",
    "Interpretation — what meaning you gave it",
  ]) {
    assert.ok(day2.includes(label));
  }
  assert.ok((day2.match(/compiled-workbook-response/g) ?? []).length >= 6);

  assert.match(day3, /I will count the protection criterion as OCCURRED when/);
  assert.match(day3, /aria-label="Your answer: I will count the protection criterion as OCCURRED when:"/);
  assert.doesNotMatch(day3, /aria-label="Your answer: My Risk Check/);
  assert.doesNotMatch(day3, /aria-label="Your answer: My minimum Risk Check/);
  assert.match(day3, /type="number"[^>]+max="10"[^>]+aria-label="My rating:/);
  assert.doesNotMatch(day3, /aria-label="Your answer: On a scale of 1–10/);
  assert.match(day3, /type="number"[^>]+max="100"[^>]+aria-label="When your target context occurs/);

  assert.match(day5, /handbook-response-table/);
  assert.match(day5, /Time \/ context/);
  assert.match(day5, /<textarea/);

  assert.match(day7, /Write down the ONE thing you learned from the experiment/);
  assert.match(day7, /aria-label="Your answer: Write down the ONE thing you learned from the experiment\."/);

  assert.match(day8, /aria-label="Eligible target opportunities observed:/);
  assert.match(day8, /aria-label="Checks initiated \(Minimum or Full\):/);
  assert.match(day8, /type="number"[^>]+max="7"/);

  assert.match(day10, /handbook-response-table/);
  assert.match(day10, /Protection Pattern Investigated/);
  assert.match(day10, /aria-label="Your answer: Letter to My Future Self"/);
});

test("compiled handbook inputs remain inside the existing workbook persistence contract", async () => {
  const [compiler, player, enhancement] = await Promise.all([
    readFile(new URL("../lib/content-compiler.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/learning/programme-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/learning/handbook-document-enhancements.ts", import.meta.url), "utf8"),
  ]);

  assert.match(compiler, /ensureWorkbookBindings/);
  assert.ok(compiler.includes("textarea|input|select"));
  assert.match(compiler, /stableWorkbookToken/);
  assert.match(player, /HTMLTextAreaElement \| HTMLInputElement \| HTMLSelectElement/);
  assert.match(player, /onChange=\{onDocumentInput\}/);
  assert.match(enhancement, /querySelector\("\[data-field-id\]"\)/);
});
