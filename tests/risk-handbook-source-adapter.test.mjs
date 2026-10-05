import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const source = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

function paragraph(text) {
  const parts = String(text).split("\n");
  const body = parts.map((part, index) =>
    (index ? "<w:br/>" : "") +
    "<w:r><w:t>" +
    part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
    "</w:t></w:r>",
  ).join("");
  return "<w:p>" + body + "</w:p>";
}

function storedZip(name, bytes) {
  const nameBytes = Buffer.from(name);
  const data = Buffer.from(bytes);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);

  const centralOffset = local.length + nameBytes.length + data.length;
  const centralSize = central.length + nameBytes.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([local, nameBytes, data, central, nameBytes, eocd]);
}

function riskHandbookDocx() {
  const pages = [
    paragraph("RISK LAB™"),
    paragraph("School Edition"),
    paragraph("The Risk Investigation Handbook"),
    paragraph("WELCOME"),
    paragraph("Dear Learner,"),
    paragraph("You are about to begin a 10-day investigation."),
    paragraph("┌────────────────────\\nWEEK 1 — FOUNDATION\\nDay 1 ●─── Concept Studio 1: Seeing Protection\\nDay 2 ●─── Concept Studio 2: Thinking Like an Investigator\\nDay 3 ●─── Risk Lab Phase A ← EXPERIMENT BEGINS\\n└────────────────────"),
    paragraph("DAY 1 OF 10"),
    paragraph("Concept Studio 1 — Seeing Protection"),
    paragraph("What was actually in place at the start of the opportunity?"),
    paragraph("☐ Same"),
    paragraph("☐ Different"),
    paragraph("✅ Checkpoint"),
    paragraph("1. What is a risk?"),
    paragraph("Answers:"),
    paragraph("1. Risk is the possibility of an unwanted outcome under uncertainty."),
    paragraph("DAY 2 OF 10"),
    paragraph("Concept Studio 2 — Thinking Like an Investigator"),
    paragraph("What I chose to check (generic description only):"),
    paragraph("What I remember:"),
    paragraph("What the record actually shows (generic status only):"),
    paragraph("Observation — what actually happened:"),
    paragraph("Interpretation — what meaning you gave it:"),
    paragraph("DAY 3 OF 10"),
    paragraph("Risk Lab — Phase A"),
    paragraph("┌────────────────────\nEXPERIMENT POSITION:\nDay 1 of 7 begins when this session ends.\n└────────────────────"),
    paragraph("Family: ☐ Prevent ☐ Limit ☐ Recover"),
    paragraph("Confidence:"),
    paragraph("My rating: ___ /10"),
    paragraph("DAY 4 OF 10"),
    paragraph("Concept Studio 3 — Understanding the Pattern"),
    paragraph("What surprised you?"),
    paragraph("DAY 5 OF 10"),
    paragraph("Evidence Studio + Day 3 Checkpoint"),
    paragraph("Element What Happened\nTime / context\nRisk context\nIntended Protection Position\nActual Protection Position at start"),
    paragraph("WEEKEND"),
    paragraph("Field Experiment"),
    paragraph("DAY 6 OF 10"),
    paragraph("Experiment Clinic"),
    paragraph("What needs adjusting?"),
    paragraph("DAY 7 OF 10"),
    paragraph("Final Field Application"),
    paragraph("Day Observation Target opportunity? Check completed? Full or Minimum? Protective Action Implemented? Action relationship Protection coverage relationship Trade-off / Constraint Outcome\n1 ☐ Rec ☐ Miss ☐ Y ☐ N ☐ Unk ☐ Y ☐ N ☐ N/A ☐ Full ☐ Min ☐ N/A ☐ Implemented ☐ Not Implemented ☐ Unknown ☐ N/A ☐ Same ☐ Partial ☐ Diff ☐ None ☐ Unclear ☐ N/A ☐ Matched ☐ Incomplete ☐ Additional ☐ Unclear ☐ N/A ☐ Trade-off ☐ Constraint ☐ Both ☐ Neither ☐ Unclear ☐ N/A ☐ O ☐ D ☐ U ☐ N/A\n2–7 (repeat structure)"),
    paragraph("DAY 8 OF 10"),
    paragraph("Evidence Review"),
    paragraph("Observation days completed: _______ / 7"),
    paragraph("Risk Check Initiation Rate: _______ %"),
    paragraph("DAY 9 OF 10"),
    paragraph("Concept Studio 4 — Transfer & Meta-Risk"),
    paragraph("Where else in your life could you use this method?"),
    paragraph("DAY 10 OF 10"),
    paragraph("Integration & Next Bridge"),
    paragraph("📖 Your Journey Continues"),
    paragraph("☐ Habit Lab\n☐ Decision Lab\n☐ Money Lab\n☐ Identity Lab"),
    paragraph("RISK INVESTIGATION CERTIFICATE"),
    paragraph("This certifies that"),
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:body>" + pages.join("") + "</w:body></w:document>";
  return storedZip("word/document.xml", Buffer.from(xml));
}

test("real BIS handbook grammar compiles from Word into the 13-position Programme Player contract", async () => {
  const tsSource = await source("lib/content-source-adapters.ts");
  const compiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
  }).outputText;

  const temp = await mkdtemp(join(tmpdir(), "bis-handbook-adapter-"));
  try {
    const modulePath = join(temp, "content-source-adapters.mjs");
    const capabilityPath = join(temp, "lab-factory-capabilities.mjs");
    await writeFile(modulePath, compiled, "utf8");
    await writeFile(join(temp, "docx-table.mjs"), await source("lib/docx-table.mjs"), "utf8");
    await writeFile(capabilityPath, await source("lib/lab-factory-capabilities.mjs"), "utf8");
    const adapter = await import(pathToFileURL(modulePath).href + "?v=" + Date.now());

    const bytes = riskHandbookDocx();
    const output = await adapter.adaptLearningSource(
      new Uint8Array(bytes),
      "DOCX",
      "RSK",
      "1.0",
      "school",
      { title: "Risk Lab™ Learning Module", slug: "risk" },
    );
    const programme = JSON.parse(new TextDecoder().decode(output));

    assert.equal(programme.edition, "school");
    assert.equal(programme.identity.subtitle, "The Risk Investigation Handbook");
    assert.deepEqual(
      programme.treatment.pages.map((page) => page.key),
      ["Welcome","Day 1","Day 2","Day 3","Day 4","Day 5","Weekend","Day 6","Day 7","Day 8","Day 9","Day 10","Certificate"],
    );
    assert.equal(programme.treatment.pages.find((page) => page.key === "Day 1").label, "Concept Studio 1 — Seeing Protection");
    assert.equal(programme.treatment.pages.find((page) => page.key === "Day 3").experimentPosition, "Day 1 of 7 begins when this session ends.");

    const day1 = programme.treatment.pages.find((page) => page.key === "Day 1").html;
    assert.match(day1, /workbook-choice-response/);
    assert.match(day1, /Answers:/);

    const day2 = programme.treatment.pages.find((page) => page.key === "Day 2").html;
    assert.match(day2, /What the record actually shows/);
    assert.match(day2, /Observation — what actually happened/);
    assert.match(day2, /Interpretation — what meaning you gave it/);
    assert.ok((day2.match(/data-source-key=/g) ?? []).length >= 5);

    const day3 = programme.treatment.pages.find((page) => page.key === "Day 3").html;
    assert.match(day3, /Family of Protection/);
    assert.match(day3, />Prevent</);
    assert.match(day3, />Recover</);
    assert.match(day3, /type="number"/);

    const day5 = programme.treatment.pages.find((page) => page.key === "Day 5").html;
    assert.match(day5, /handbook-response-table/);
    assert.match(day5, /Time \/ context/);

    const day7 = programme.treatment.pages.find((page) => page.key === "Day 7").html;
    assert.match(day7, /handbook-response-table/);
    assert.ok((day7.match(/workbook-choice-response/g) ?? []).length >= 60);

    const day10 = programme.treatment.pages.find((page) => page.key === "Day 10").html;
    assert.match(day10, /Choose your next Lab/);
    assert.match(day10, />Habit Lab</);
    assert.match(day10, />Identity Lab</);

    assert.equal(programme.treatment.pages.at(-1).label, "RISK INVESTIGATION CERTIFICATE");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});


test("pasted Markdown learning source preserves publication semantics before Programme Player rendering", async () => {
  const tsSource = await source("lib/content-source-adapters.ts");
  const compiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      verbatimModuleSyntax: false,
    },
  }).outputText;

  const temp = await mkdtemp(join(tmpdir(), "bis-markdown-handbook-adapter-"));
  try {
    const modulePath = join(temp, "content-source-adapters.mjs");
    await writeFile(modulePath, compiled, "utf8");
    await writeFile(join(temp, "docx-table.mjs"), await source("lib/docx-table.mjs"), "utf8");
    await writeFile(join(temp, "lab-factory-capabilities.mjs"), await source("lib/lab-factory-capabilities.mjs"), "utf8");
    const adapter = await import(pathToFileURL(modulePath).href + "?v=" + Date.now());

    const body = [
      "# RISK LAB™",
      "School Edition",
      "The Risk Investigation Handbook",
      "",
      "# WELCOME",
      "HOW TO USE THIS BOOK",
      "",
      "Icon | Meaning",
      "--- | ---",
      "📖 | Read this",
      "✍️ | Activity — do this",
      "",
      "- First safety rule",
      "- Second safety rule",
      "- Third safety rule",
      "",
      "---",
      "",
      "# DAY 1 OF 10",
      "Concept Studio 1 — Seeing Protection",
      "",
      "┌────────────────────────",
      "| SESSION: Concept Studio 1 |",
      "| TIME: 90 minutes |",
      "| MODE: Facilitated |",
      "└────────────────────────",
      "",
      "📖 What Is a Risk?",
      "A risk is a possibility under uncertainty.",
      "",
      "# DAY 2 OF 10",
      "Concept Studio 2 — Thinking Like an Investigator",
      "Day two body.",
      "# DAY 3 OF 10",
      "Risk Lab — Phase A",
      "Day three body.",
      "# DAY 4 OF 10",
      "Concept Studio 3",
      "Day four body.",
      "# DAY 5 OF 10",
      "Evidence Studio",
      "Day five body.",
      "# WEEKEND",
      "Field Experiment",
      "Weekend body.",
      "# DAY 6 OF 10",
      "Experiment Clinic",
      "Day six body.",
      "# DAY 7 OF 10",
      "Final Field Application",
      "Day seven body.",
      "# DAY 8 OF 10",
      "Evidence Review",
      "Day eight body.",
      "# DAY 9 OF 10",
      "Transfer & Meta-Risk",
      "Day nine body.",
      "# DAY 10 OF 10",
      "Integration & Next Bridge",
      "Day ten body.",
      "# RISK INVESTIGATION CERTIFICATE",
      "This certifies that",
    ].join("\\n");

    const output = await adapter.adaptLearningSource(
      new TextEncoder().encode(body),
      "MARKDOWN",
      "RSK",
      "2.0",
      "school",
      { title: "Risk Lab™ Learning Module", slug: "risk" },
    );
    const programme = JSON.parse(new TextDecoder().decode(output));
    const welcome = programme.treatment.pages.find((page) => page.key === "Welcome").html;
    const day1 = programme.treatment.pages.find((page) => page.key === "Day 1").html;

    assert.match(welcome, /<h3>HOW TO USE THIS BOOK<\\/h3>/);
    assert.match(welcome, /<table class="handbook-table">/);
    assert.match(welcome, /<th scope="col">Icon<\\/th>/);
    assert.match(welcome, /<ul><li>First safety rule<\\/li>/);
    assert.match(welcome, /handbook-section-rule/);
    assert.match(day1, /handbook-source-callout/);
    assert.doesNotMatch(day1, /[┌┐└┘│]/u);
    assert.match(day1, /<h3>📖 What Is a Risk\\?<\\/h3>/u);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
