import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function adapterModule() {
  const source = await readFile(new URL("../lib/content-source-adapters.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
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
    "What the record actually shows:",
    "How close was my memory to the record?",
    "DAY 3 OF 10",
    "Risk Lab — Phase A",
    [
      "SESSION: Risk Lab — Phase A",
      "TIME: 90 minutes",
      "EXPERIMENT POSITION:",
      "Day 1 of 7 begins when this session ends.",
    ],
    "What do you intend your protection to be?",
    "My intended protection position:",
    "Confidence:",
    "1 — 2 — 3 — 4 — 5 — 6 — 7 — 8 — 9 — 10",
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
    "DAY 8 OF 10",
    "Evidence Review",
    "Observation days completed: _______ / 7",
    "Missing / unrecorded days: _______ / 7",
    "Risk Check Initiation Rate: _______ %",
    "1. Did target protection opportunities occur on most days? Why or why not?",
    "2. When they occurred, did you check?",
    "DAY 9 OF 10",
    "Concept Studio 4 — Transfer & Meta-Risk",
    "Which one would you investigate next?",
    "DAY 10 OF 10",
    "Integration & Next Bridge",
    "📖 My Risk Investigation Profile",
    ["Element My Answer", "Protection Pattern Investigated", "Risk Context", "Working Equation", "Next Protection Pattern to Investigate"],
    "What I can now do:",
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

test("production-style Word handbooks compile into the canonical 10-day BIS journey", async () => {
  const { adaptLearningSource } = await adapterModule();
  const bytes = await adaptLearningSource(
    riskStyleHandbookDocx(),
    "DOCX",
    "RSK",
    "1.0-S",
    "school",
    { title: "Risk Lab™ Learning Module", slug: "risk" },
  );
  const programme = JSON.parse(new TextDecoder().decode(bytes));

  assert.equal(programme.labCode, "RSK");
  assert.equal(programme.edition, "school");
  assert.equal(programme.treatment.pages.length, 13);
  assert.deepEqual(
    programme.treatment.pages.map((page) => page.key),
    ["Welcome","Day 1","Day 2","Day 3","Day 4","Day 5","Weekend","Day 6","Day 7","Day 8","Day 9","Day 10","Certificate"],
  );
  assert.equal(programme.treatment.pages.find((page) => page.key === "Day 1").label, "Concept Studio 1 — Seeing Protection");
  assert.equal(programme.treatment.pages.find((page) => page.key === "Day 3").label, "Risk Lab — Phase A");
  assert.match(programme.treatment.pages.find((page) => page.key === "Day 3").experimentPosition, /Day 1 of 7/);
  assert.match(programme.treatment.pages.find((page) => page.key === "Certificate").label, /RISK INVESTIGATION CERTIFICATE/);
});

test("compiled handbooks manufacture answer spaces without turning authored answer keys into fields", async () => {
  const { adaptLearningSource } = await adapterModule();
  const bytes = await adaptLearningSource(
    riskStyleHandbookDocx(),
    "DOCX",
    "RSK",
    "1.0-S",
    "school",
    { title: "Risk Lab™ Learning Module", slug: "risk" },
  );
  const programme = JSON.parse(new TextDecoder().decode(bytes));
  const day1 = programme.treatment.pages.find((page) => page.key === "Day 1").html;
  const day2 = programme.treatment.pages.find((page) => page.key === "Day 2").html;
  const day5 = programme.treatment.pages.find((page) => page.key === "Day 5").html;
  const day8 = programme.treatment.pages.find((page) => page.key === "Day 8").html;
  const day10 = programme.treatment.pages.find((page) => page.key === "Day 10").html;

  assert.match(day1, /<textarea[^>]+data-source-key=/);
  assert.match(day1, /<select[^>]+data-source-key=/);
  assert.match(day1, /Answers:/);
  assert.equal((day1.match(/Risk is possibility under uncertainty\./g) ?? []).length, 1);

  assert.match(day2, /What I chose to check/);
  assert.match(day2, /compiled-workbook-response/);

  assert.match(day5, /workbook-answer-table/);
  assert.match(day5, /Time \/ context/);
  assert.match(day5, /Protective Action/);
  assert.match(day5, /<textarea/);

  assert.match(day8, /type="number"/);
  assert.match(day8, /max="7"/);
  assert.match(day8, /Risk Check Initiation Rate/);

  assert.match(day10, /workbook-answer-table/);
  assert.match(day10, /Protection Pattern Investigated/);
  assert.match(day10, /Next Protection Pattern to Investigate/);
  assert.match(day10, /What I can now do/);
});

test("the Programme Player persists every compiled handbook control type", async () => {
  const [compiler, player, enhancement, css] = await Promise.all([
    readFile(new URL("../lib/content-compiler.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/learning/programme-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/learning/handbook-document-enhancements.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/learning/programme-player.css", import.meta.url), "utf8"),
  ]);

  assert.match(compiler, /<(textarea\|input\|select)/);
  assert.match(compiler, /stableWorkbookToken/);
  assert.match(player, /HTMLTextAreaElement \| HTMLInputElement \| HTMLSelectElement/);
  assert.match(player, /onChange=\{onDocumentInput\}/);
  assert.match(enhancement, /querySelector\("\[data-field-id\]"\)/);
  assert.match(css, /workbook-answer-table/);
  assert.match(css, /select\.response/);
});
