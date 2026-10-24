import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";
import { loadPreparedLearningSource } from "../lib/prepared-learning-source.mjs";
import { prepareHandbookReplacements } from "../lib/prepare-handbook-replacements.mjs";
import { loadStaticLearningPackage } from "../lib/static-learning-package.mjs";

const manifest = JSON.parse(await readFile("content/learning-prepared/handbooks-20261024/manifest.json", "utf8"));
const tools = await loadContentTools();
test.after(() => tools.dispose());
const pageKeys = ["Welcome", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Weekend", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Certificate"];

test("replacement scope is the complete Volume 1 plus exactly the supplied partial Volume 2", () => {
  assert.equal(manifest.editions.filter(entry => entry.volume === 1).length, 36);
  assert.deepEqual(manifest.editions.filter(entry => entry.volume === 2).map(entry => `${entry.code}:${entry.edition}`),
    ["CAR:school", "CAR:emerging_adult", "CAR:workplace", "LCH:school", "LCH:emerging_adult", "LCH:workplace", "FAI:school", "FAI:emerging_adult"]);
});

for (const entry of manifest.editions) test(`${entry.code}/${entry.edition}: source, compiler and private answer identities agree`, async () => {
  const saved = await loadPreparedLearningSource(entry.code, entry.edition);
  const artifact = await tools.compileLearningEdition(saved.bytes, entry.code, saved.sourceVersion, entry.edition);
  assert.equal(artifact.hash, entry.artifactHash);
  const programme = JSON.parse(artifact.content);
  assert.deepEqual(programme.treatment.pages.map(page => page.key), pageKeys);
  assert.ok(programme.sourceTrace.authority.includes(entry.sourceSha256));
  assert.ok(programme.sourceTrace.authority.includes(entry.sourceId));
  assert.equal(programme.handbookId, `${entry.slug}-lab-volume-${entry.volume}`);
  const html = programme.treatment.pages.map(page => page.html).join("\n");
  const ids = [...html.matchAll(/data-field-id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, entry.fields);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => id.startsWith(`${entry.code}.WB.${entry.edition.toUpperCase()}.`)));
  if (["HAB", "DEC", "MON", "IDN", "ATT"].includes(entry.code)) {
    const previous = await loadStaticLearningPackage(entry.slug, entry.edition);
    const oldIds = new Set(previous.treatment.pages.flatMap(page => [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map(match => match[1])));
    assert.ok(ids.every(id => !oldIds.has(id)), "Replacement questions cannot inherit answers from the old manuscript.");
  }
  assert.match(html, /data-privacy-class="P3"/);
  const welcome = programme.treatment.pages[0].html;
  const baseline = [...welcome.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(match => match[0]).find(table => table.includes('<th scope="col">Never</th>'));
  assert.ok(baseline, "The authored behaviour profile retains its table relationship.");
  const ratings = [...baseline.matchAll(/<select\b[\s\S]*?<\/select>/g)];
  assert.equal(ratings.length, 10, "Each behaviour has its own frequency response.");
  for (const [select] of ratings) assert.deepEqual([...select.matchAll(/<option(?: value="([^"]*)")?>/g)].map(match => match[1] ?? ""), ["", "Never", "Rarely", "Sometimes", "Often", "Always"]);
  for (const [select] of html.matchAll(/<select\b[\s\S]*?<\/select>/g)) {
    assert.doesNotMatch(select, /☐/, "Inline authored choices are separate options, never one concatenated checkbox string.");
    assert.doesNotMatch(select, /<option value="[^\"]*\|/, "Table cells cannot become dropdown options containing table separators or neighbouring row labels.");
  }
  const responseTables = [...html.matchAll(/<table class="handbook-table handbook-response-table">[\s\S]*?<\/table>/g)].map(match => match[0]);
  assert.ok(responseTables.some(table => table.includes('type="date"')), "Authored experiment trackers accept dates.");
  assert.ok(responseTables.some(table => table.includes('What to record') && table.includes('<select')), "Observation entries retain their own checkbox choices.");
  for (const table of responseTables) assert.doesNotMatch(table, /☐/, "Authored response choices become usable controls within their own table cell.");
  const day3 = programme.treatment.pages.find(page => page.key === "Day 3");
  assert.equal(day3.labHandoff.source, "AUTHORED");
  if (["CAR", "LCH"].includes(entry.code)) {
    assert.equal(programme.experimentSchedule.durationDays, 30);
    assert.equal(programme.experimentSchedule.startsAfterProgrammeDay, 3);
    assert.equal(programme.experimentSchedule.finalReviewAfterExperimentDay, 30);
    assert.deepEqual(programme.experimentSchedule.interimReviewProgrammeDays, [8, 9, 10]);
    assert.deepEqual(programme.experimentSchedule.observationWindows.map(window => [window.startDay, window.endDay]), [[1, 7], [8, 14], [15, 21], [22, 30]]);
    assert.doesNotMatch(html, /Wait — let me correct that|Let me re-check|Let me revise:|Your 30-day experiment runs from Day 3 \(after the session\) to Day 8|You've finished your experiment\.|You have completed (?:Career|Launch) Lab\./);
    assert.match(programme.treatment.pages.find(page => page.key === "Day 10").html, /Continue the experiment until you have completed 30 calendar days/);
    assert.match(programme.treatment.pages.at(-1).html, /Finishing the ten teaching touchpoints alone does not award this certificate/);
  } else assert.equal(programme.experimentSchedule, undefined);
});

test("authored writing lines provide one response and inline options remain separate", async () => {
  const content = pageKeys.map(key => `${key.toUpperCase()}\n\n${key === "Day 1" ? "Seeing evidence\n\nWhat did you notice?\n\nYour answer:\n\n___________\n\nMy next action:\n\n___________\n\nWhich response fits?\n\n☐ One ☐ Two ☐ Three\n\nWhat I noticed: The example was already answered." : "Read this authored example."}`).join("\n\n");
  const source = await tools.adaptLearningSource(Buffer.from(content), "MARKDOWN", "HAB", "test", "school", { title: "Habit Lab Learning Module", slug: "habit" });
  const page = JSON.parse(Buffer.from(source).toString()).treatment.pages.find(page => page.key === "Day 1");
  assert.equal((page.html.match(/<(?:input|select|textarea)\b/g) ?? []).length, 3, "One control per writing line plus one choice prompt; answered narrative has none.");
  assert.match(page.html, /aria-label="What did you notice\?"/);
  assert.match(page.html, /aria-label="My next action:"/);
  assert.match(page.html, /value="One"/);
  assert.match(page.html, /value="Two"/);
  assert.match(page.html, /value="Three"/);
});

test("combined DOCX selection cannot deliver the first handbook to a different Lab or edition", async () => {
  const bytes = await readFile("content/learning-sources/volume-1-handbooks-20261024.docx");
  const adapted = JSON.parse(new TextDecoder().decode(await tools.adaptLearningSource(bytes, "DOCX", "DEC", "test", "workplace", { title: "Decision Lab™ Learning Module", slug: "decision" })));
  const html = adapted.treatment.pages.map(page => page.html).join("\n");
  assert.match(html, /DEC-LM-1.0-WK/);
  assert.doesNotMatch(html, /HAB-LM-1.0|School Edition/);
  await assert.rejects(tools.adaptLearningSource(bytes, "DOCX", "CAR", "test", "school", { title: "Career Lab™ Learning Module", slug: "career" }), /found 0/);
});

test("saved source rejects missing editions, traversal and tampered bytes", async () => {
  await assert.rejects(loadPreparedLearningSource("FAI", "workplace"), /No saved handbook/);
  await assert.rejects(loadPreparedLearningSource("../HAB", "school"), /Choose/);
  const root = await mkdtemp(join(tmpdir(), "bis-saved-handbook-"));
  try {
    const folder = join(root, "content", "learning-prepared", "handbooks-20261024");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "manifest.json"), JSON.stringify(manifest));
    const entry = manifest.editions[0];
    const source = await readFile(`content/learning-prepared/handbooks-20261024/${entry.asset}`, "utf8");
    const { gzipSync } = await import("node:zlib");
    await writeFile(join(folder, entry.asset), gzipSync('{"kind":"LEARNING_MODULE"}').toString("base64"));
    await assert.rejects(loadPreparedLearningSource(entry.code, entry.edition, root), /source record/);
    await writeFile(join(folder, entry.asset), source);
    await loadPreparedLearningSource(entry.code, entry.edition, root);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("bulk replacement attaches all supplied editions before compiling and never publishes or invents a missing edition", async () => {
  const calls = [];
  const results = await prepareHandbookReplacements({
    editions: manifest.editions,
    items: [...new Set(manifest.editions.map(entry => entry.code))].map(code => ({ id: `module:${code}`, code, kind: "LEARNING_MODULE", status: "ACTIVE" })),
    createDraft: async item => ({ id: `${item.id}:replacement`, status: "DRAFT", sourceFiles: [] }),
    loadSource: async (draft, edition) => (await loadPreparedLearningSource(edition.code, edition.edition)).bytes,
    saveSource: async (draft, edition) => { calls.push(`${draft.id}:attach:${edition.edition}`); },
    compile: async draft => { calls.push(`${draft.id}:compile`); },
  });
  assert.equal(results.length, 15);
  assert.equal(calls.filter(call => call.includes(":attach:")).length, 44);
  for (const result of results) for (const edition of result.editions) {
    assert.ok(calls.indexOf(`${result.versionId}:attach:${edition}`) < calls.indexOf(`${result.versionId}:compile`));
  }
  assert.deepEqual(results.find(entry => entry.code === "FAI").editions, ["school", "emerging_adult"]);
});

test("a failed attachment stops preparation before compilation", async () => {
  const calls = [];
  await assert.rejects(prepareHandbookReplacements({
    editions: manifest.editions.slice(0, 3), items: [{ id: "HAB", code: "HAB", kind: "LEARNING_MODULE", status: "ACTIVE" }],
    createDraft: async () => ({ id: "HAB:new", status: "DRAFT", sourceFiles: [] }),
    loadSource: async () => new Uint8Array(), saveSource: async () => { throw new Error("Upload rejected"); },
    compile: async () => { calls.push("compiled"); },
  }), /Upload rejected/);
  assert.deepEqual(calls, []);
});
