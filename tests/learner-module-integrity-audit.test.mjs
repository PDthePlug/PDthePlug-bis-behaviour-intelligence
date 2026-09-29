import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const projectRoot = new URL("..", import.meta.url);
const handbookRoot = new URL("../public/handbooks/v1/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", handbookRoot), "utf8"));
const source = (path) => readFile(new URL(path, projectRoot), "utf8");

const decode = async (asset) => {
  const raw = await readFile(new URL(asset, handbookRoot), "utf8");
  return JSON.parse(gunzipSync(Buffer.from(raw.trim(), "base64")));
};

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, "\n")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\r/g, "")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{2,}/g, "\n")
  .trim();

const expectedPageKeys = [
  "Welcome","Day 1","Day 2","Day 3","Day 4","Day 5","Weekend",
  "Day 6","Day 7","Day 8","Day 9","Day 10","Certificate",
];

test("integrity audit covers every currently live learning package", async () => {
  assert.equal(manifest.handbooks.length, 15);
  const codes = [...new Set(manifest.handbooks.map((item) => item.code))].sort();
  assert.deepEqual(codes, ["ATT","DEC","HAB","IDN","MON"]);

  for (const code of codes) {
    const editions = manifest.handbooks
      .filter((item) => item.code === code)
      .map((item) => item.edition)
      .sort();
    assert.deepEqual(editions, ["emerging_adult","school","workplace"]);
  }

  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    assert.deepEqual(programme.treatment.pages.map((page) => page.key), expectedPageKeys);
    assert.equal(programme.labCode, item.code);
    assert.equal(programme.edition, item.edition);
  }
});

test("every imported response control is traceable and uniquely bound", async () => {
  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    const ids = [];
    for (const page of programme.treatment.pages) {
      const controls = [...page.html.matchAll(/<(textarea|input|select)\b[^>]*>/gi)].map((match) => match[0]);
      for (const control of controls) {
        const id = control.match(/data-field-id=["']([^"']+)["']/i)?.[1];
        assert.ok(id, `${item.code} ${item.edition} ${page.key}: control is missing data-field-id`);
        assert.match(control, /data-source-key=/i, `${id}: missing source key`);
        assert.match(control, /data-purpose=/i, `${id}: missing purpose`);
        assert.match(control, /data-privacy-class=/i, `${id}: missing privacy class`);
        ids.push(id);
      }
    }
    assert.equal(new Set(ids).size, ids.length, `${item.code} ${item.edition}: duplicate field IDs`);
  }
});

test("paper-era artefacts found in the live corpus have explicit digital treatments", async () => {
  let underscoreRuns = 0;
  let printableCheckboxes = 0;
  let consecutiveResponses = 0;
  let tables = 0;
  let signatureOrMetaLines = 0;

  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    for (const page of programme.treatment.pages) {
      const text = strip(page.html);
      underscoreRuns += [...text.matchAll(/_{3,}/g)].length;
      printableCheckboxes += [...text.matchAll(/[□☐]/g)].length;
      consecutiveResponses += [...page.html.matchAll(/<\/textarea>\s*<textarea\b/gi)].length;
      tables += [...page.html.matchAll(/<table\b/gi)].length;
      signatureOrMetaLines += [...text.matchAll(/\b(?:signed|facilitator|workbook id|date)\s*:/gi)].length;
    }
  }

  assert.ok(underscoreRuns > 0);
  assert.ok(printableCheckboxes > 0);
  assert.ok(consecutiveResponses > 0);
  assert.ok(tables > 0);
  assert.ok(signatureOrMetaLines > 0);

  const enhancement = await source("app/learning/handbook-document-enhancements.ts");
  assert.match(enhancement, /cleanOrphanedResponseControls/);
  assert.match(enhancement, /upgradePrintableCheckboxes/);
  assert.match(enhancement, /convertSimplePaperBlanks/);
  assert.match(enhancement, /convertNumberedPaperBlanks/);
  assert.match(enhancement, /convertPriorityWorksheetRows/);
  assert.match(enhancement, /enhanceTables/);
  assert.match(enhancement, /replacePaperIdentityFields/);
  assert.match(enhancement, /hideEditorialProductionMetadata/);
});

test("representative problem areas from learner QA remain inside the audited corpus", async () => {
  const required = [
    "Dear Future Me",
    "Eligible target opportunities observed",
    "Options I See",
    "State / Pressure",
    "Was there anything that surprised you?",
    "Observation days completed",
    "A REMINDER ON CONFIDENTIALITY AND PRIVACY",
    "Take It Into Real Life",
    "Who I asked:",
    "What they said:",
    "Facilitator:",
  ];
  const corpus = [];
  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    corpus.push(...programme.treatment.pages.map((page) => strip(page.html)));
  }
  const fullText = corpus.join("\n").toLowerCase();
  for (const term of required) {
    assert.ok(fullText.includes(term.toLowerCase()), `Audit corpus is missing representative area: ${term}`);
  }
});


test("Day 8 system-owned figures have explicit live-Lab auto-fill contracts", async () => {
  const player = await source("app/learning/programme-player.tsx");
  const required = [
    "Eligible opportunities observed",
    "Adherence Rate",
    "Prediction Accuracy",
    "Your control rating before the experiment was",
    "Full Decision Pauses completed",
    "Secondary evidence — Minimum Version uses",
    "Predicted pause rate",
    "Actual pause rate",
    "Full Decision Pauses where an additional option appeared",
    "Option Expansion Rate",
    "Your deliberateness rating before the experiment was",
    "Observation days completed",
    "Missing / unrecorded days",
    "Pauses initiated (Minimum or Full)",
    "Pause Initiation Rate",
    "Full Pauses completed",
    "Full Pause Completion Rate",
    "Minimum Pauses completed",
    "Predicted Pause Initiation Rate",
    "Actual Pause Initiation Rate",
    "Your awareness rating before the experiment was",
    "Your confidence rating before the experiment was",
  ];

  for (const label of required) {
    assert.ok(player.includes(label), `Missing Day 8 auto-fill contract: ${label}`);
  }

  assert.match(player, /responseNumber\(source, "HAB\.CONTROL\.PRE"\)/);
  assert.match(player, /responseNumber\(source, "DEC\.DELIBERATENESS\.PRE"\)/);
  assert.match(player, /responseNumber\(source, "DEC\.EQUATION\.CONFIDENCE_PRE"\)/);
  assert.match(player, /responseNumber\(source, "MON\.AWARENESS\.PRE"\)/);
  assert.match(player, /responseNumber\(source, "MON\.EQUATION\.CONFIDENCE_PRE"\)/);
  assert.match(player, /Not separately recorded/);
});
