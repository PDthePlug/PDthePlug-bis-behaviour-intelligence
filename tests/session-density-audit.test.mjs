import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const root = new URL("..", import.meta.url);
const handbookRoot = new URL("../public/handbooks/v1/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", handbookRoot), "utf8"));

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
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const questions = count(/\?/g, text);
  const controls = count(/<(?:textarea|input|select)\b/gi, page.html);
  const checkpoints = count(/\bcheckpoint\b/gi, text);
  const tables = count(/<table\b/gi, page.html);
  const listItems = count(/<li\b/gi, page.html);
  const headings = count(/<h[1-4]\b/gi, page.html);
  const activityMarkers = count(/\b(?:pause|predict|reflect|write|investigate|evidence challenge|observer question|today's insight|discuss|pair|practice|try this|activity|mission)\b/gi, text);
  const callouts = count(/class=["'][^"']*(?:callout|prompt|activity|checkpoint|exercise|reflection)[^"']*["']/gi, page.html);
  return { words, questions, controls, checkpoints, tables, listItems, headings, activityMarkers, callouts };
}

test("prints live BIS day-by-day session density audit", async () => {
  console.log("\n=== BIS_SESSION_DENSITY_AUDIT_START ===");
  for (const item of manifest.handbooks) {
    const programme = await decode(item.asset);
    console.log(`PACKAGE|${item.code}|${item.edition}|${programme.title}`);
    for (const page of programme.treatment.pages) {
      if (!page.programmeDay && page.key !== "Weekend") continue;
      const m = metrics(page);
      console.log([
        "DAY",
        item.code,
        item.edition,
        page.key,
        page.programmeDay ?? "weekend",
        page.phase,
        `words=${m.words}`,
        `questions=${m.questions}`,
        `controls=${m.controls}`,
        `checkpoints=${m.checkpoints}`,
        `tables=${m.tables}`,
        `lists=${m.listItems}`,
        `headings=${m.headings}`,
        `markers=${m.activityMarkers}`,
        `callouts=${m.callouts}`,
      ].join("|"));
    }
  }
  console.log("=== BIS_SESSION_DENSITY_AUDIT_END ===\n");
});
