import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const root = new URL("../public/handbooks/v1/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", root), "utf8"));

const decode = async (asset) => {
  const raw = await readFile(new URL(asset, root), "utf8");
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

const count = (value, regex) => [...value.matchAll(regex)].length;

test("diagnose all live handbook packages for digital-form integrity", async () => {
  const report = [];
  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    for (const page of programme.treatment.pages) {
      const html = page.html;
      const text = strip(html);
      const controls = count(html, /<(?:textarea|input|select)\b/gi);
      const textareas = count(html, /<textarea\b/gi);
      const checkboxes = count(html, /<input\b[^>]*type=["']checkbox["']/gi);
      const radios = count(html, /<input\b[^>]*type=["']radio["']/gi);
      const tables = count(html, /<table\b/gi);
      const tableHeaders = count(html, /<th\b/gi);
      const dataLabels = count(html, /data-label=/gi);
      const underscoreRuns = count(text, /_{3,}/g);
      const questionMarks = count(text, /\?/g);
      const signedLines = count(text, /\b(?:signed|signature|facilitator|workbook id)\s*:/gi);
      const dateLines = count(text, /\bdate\s*:/gi);
      const percentageBlanks = count(text, /_{3,}\s*%/g);
      const fractionBlanks = count(text, /_{3,}\s*\/\s*_{0,8}\d*/g);
      const plainNumberLines = count(text, /(?:^|\n)\s*\d+[.)]\s*(?:_{2,})?\s*(?=\n|$)/g);
      const suspiciousBlankFields = [...html.matchAll(/<(textarea|input|select)\b[^>]*data-field-id=["']([^"']+)["'][^>]*>/gi)]
        .filter((match) => {
          const before = strip(html.slice(Math.max(0, match.index - 260), match.index));
          return !/[A-Za-z0-9?)]/.test(before.slice(-120));
        }).length;

      const score =
        underscoreRuns +
        signedLines * 2 +
        dateLines +
        percentageBlanks * 2 +
        fractionBlanks * 2 +
        plainNumberLines +
        suspiciousBlankFields * 3 +
        (tables && (!tableHeaders || !dataLabels) ? 4 : 0);

      if (score || controls || tables) {
        report.push({
          code: item.code,
          edition: item.edition,
          page: page.key,
          controls,
          textareas,
          checkboxes,
          radios,
          tables,
          tableHeaders,
          dataLabels,
          underscoreRuns,
          questionMarks,
          signedLines,
          dateLines,
          percentageBlanks,
          fractionBlanks,
          plainNumberLines,
          suspiciousBlankFields,
          score,
        });
      }
    }
  }

  report.sort((a, b) => b.score - a.score || b.controls - a.controls);
  console.log("BIS_LEARNER_MODULE_INTEGRITY_AUDIT=" + JSON.stringify({
    packages: manifest.handbooks.length,
    pages: manifest.handbooks.length * 13,
    top: report.slice(0, 80),
    totals: report.reduce((acc, row) => {
      for (const key of [
        "controls","textareas","checkboxes","radios","tables","underscoreRuns","questionMarks",
        "signedLines","dateLines","percentageBlanks","fractionBlanks","plainNumberLines","suspiciousBlankFields"
      ]) acc[key] = (acc[key] ?? 0) + row[key];
      return acc;
    }, {}),
  }));

  assert.equal(manifest.handbooks.length, 15);
});


test("diagnose representative learner-facing problem areas", async () => {
  const terms = [
    "Dear Future Me",
    "Eligible target opportunities observed",
    "Options I See",
    "State / Pressure",
    "What Matters (now)",
    "Was there anything that surprised you?",
    "Step 11",
    "Observation days completed",
    "A REMINDER ON CONFIDENTIALITY AND PRIVACY",
    "Take It Into Real Life",
    "Who I asked:",
    "What they said:",
    "Facilitator:",
  ];
  const findings = [];
  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    for (const page of programme.treatment.pages) {
      const text = strip(page.html);
      for (const term of terms) {
        const index = text.toLowerCase().indexOf(term.toLowerCase());
        if (index < 0) continue;
        const htmlIndex = page.html.toLowerCase().indexOf(term.toLowerCase());
        findings.push({
          code: item.code,
          edition: item.edition,
          page: page.key,
          term,
          text: text.slice(Math.max(0, index - 350), index + 900),
          html: htmlIndex >= 0 ? page.html.slice(Math.max(0, htmlIndex - 900), htmlIndex + 1800) : "",
        });
      }
    }
  }
  console.log("BIS_REPRESENTATIVE_FORM_CONTEXT=" + JSON.stringify(findings));
  assert.ok(findings.length > 0);
});
