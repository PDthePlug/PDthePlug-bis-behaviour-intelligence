import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

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

test("all live programme days have sufficient authored substance for a facilitated 45-minute session", async () => {
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

test("session design changes the use of time instead of padding lighter days with more prose", async () => {
  const design = await source("lib/session-design.ts");

  assert.match(design, /Less reading is intentional/);
  assert.match(design, /more of the session is for practice, evidence, discussion and transfer/);
  assert.match(design, /content-rich day/);
  assert.match(design, /rest stays available as reference/);

  for (const label of ["Reconnect", "Core concept", "Quick check", "Apply", "Discuss", "Close"]) {
    assert.ok(design.includes(label), `Missing 45-minute session beat: ${label}`);
  }
});

test("handbooks interleave formative understanding checks before the end-of-day checkpoint", async () => {
  const enhancement = await source("app/learning/handbook-document-enhancements.ts");

  assert.match(enhancement, /addInterleavedConceptChecks/);
  assert.match(enhancement, /distributedConceptChecks\(candidates, 3\)/);
  assert.match(enhancement, /endCheckpointQuestions = new Set\(checkpointQuestionElements\(root\)\)/);
  assert.match(enhancement, /Quick check/);
  assert.match(enhancement, /This is for understanding, not a score/);
  assert.match(enhancement, /FORMATIVE_CHECK/);
});

test("interleaved responses use stable workbook IDs and save through the existing workbook pipeline", async () => {
  const [enhancement, player] = await Promise.all([
    source("app/learning/handbook-document-enhancements.ts"),
    source("app/learning/programme-player.tsx"),
  ]);

  assert.match(enhancement, /WB\.AUTO/);
  assert.match(enhancement, /field\.dataset\.fieldId/);
  assert.match(player, /querySelectorAll<HTMLTextAreaElement \| HTMLInputElement \| HTMLSelectElement>\("\[data-field-id\]"\)/);
  assert.match(player, /workbookResponses/);
});
