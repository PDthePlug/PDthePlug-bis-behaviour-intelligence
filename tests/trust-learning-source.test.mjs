import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";

test("owner-uploaded Trust Learning source stays immutable and compiles without borrowing Lab wording", async () => {
  const manifest = JSON.parse(await readFile("content/learning-sources/manifest.json", "utf8"));
  const source = manifest.sources.find(item => item.moduleCode === "TRU");
  const bytes = await readFile(source.sourcePath);
  assert.equal(bytes.length, 152539);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), source.uploadedSha256);
  assert.deepEqual(source.editions.map(item => item.deliveryEdition), ["school"]);
  const tools = await loadContentTools();
  try {
    const adapted = await tools.adaptLearningSource(bytes, "MARKDOWN", "TRU", "1.1", "school", { title: "Trust Lab™", slug: "trust" });
    const artifact = await tools.compileLearningEdition(adapted, "TRU", "1.1", "school");
    const pages = JSON.parse(artifact.content).treatment.pages;
    assert.equal(pages.length, 13);
    const dayThree = pages.find(page => page.key === "Day 3");
    assert.equal(dayThree.label, "The Trust Pause");
    assert.ok(dayThree.html.includes("DAY 3 — PART A"));
    assert.ok(dayThree.html.indexOf("The Trust Pause") < dayThree.html.indexOf(dayThree.labHandoff.startMarker));
    assert.ok(dayThree.html.indexOf(dayThree.labHandoff.startMarker) < dayThree.html.indexOf("Your Experiment Begins"));
    assert.ok(!pages.find(page => page.key === "Day 2").html.includes("DAY 3 — PART A"));
    const welcome = pages[0].html;
    assert.equal([...welcome.matchAll(/<select\b/g)].length, 10, "each authored baseline row needs its own answer");
    for (const option of ["Never", "Rarely", "Sometimes", "Often", "Always"]) {
      assert.equal([...welcome.matchAll(new RegExp(`value="${option}"`, "g"))].length, 10);
    }
    assert.ok(welcome.includes("💬"));
    assert.ok(welcome.includes("Let's Talk — class discussion"));
    const dayOne = pages.find(page => page.key === "Day 1").html;
    assert.match(dayOne, /<h3>🧠 What Is Trust\?<\/h3>/u);
    assert.ok(!dayOne.includes('aria-label="Your answer: 🧠 What Is Trust?"'));
    assert.ok(!dayOne.includes('aria-label="Your answer: He had never thought'));
    assert.ok(pages.every(page => !page.html.includes("```")));
    const ids = pages.flatMap(page => [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map(match => match[1]));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => id.startsWith("TRU.WB.SCHOOL.")));
    const repeated = await tools.compileLearningEdition(adapted, "TRU", "1.1", "school");
    assert.equal(repeated.hash, artifact.hash);
  } finally { await tools.dispose(); }
});

test("Learning intake rejects a Lab workbook instead of manufacturing thirteen programme pages", async () => {
  const tools = await loadContentTools();
  try {
    const workbook = Array.from({ length: 9 }, (_, index) => `# INVESTIGATION ${index + 1} — Evidence\n\nMISSION: Observe a pattern.\n\nWhat did you notice?\n\n________________\n\n`).join("\n");
    await assert.rejects(tools.adaptLearningSource(Buffer.from(workbook), "MARKDOWN", "TRU", "1.1", "school", { title: "Trust Lab™", slug: "trust" }), /authored Learning manuscript.*Lab workbook cannot supply Learning content/s);
    const bytes = Buffer.from("Original owner manuscript\r\n");
    const hash = await tools.sha256Hex(bytes);
    assert.equal(await tools.verifiedSourceHash(bytes, { sourceHash: hash, sourceBytes: bytes.length }), hash);
    await assert.rejects(tools.verifiedSourceHash(Buffer.from("Changed owner manuscript\n"), { sourceHash: hash, sourceBytes: bytes.length }), /no longer matches.*original record/);
  } finally { await tools.dispose(); }
});

test("all three authored Time Learning editions retain ten independently bound baseline rows", async () => {
  const manifest = JSON.parse(await readFile("content/learning-sources/manifest.json", "utf8"));
  const source = manifest.sources.find(item => item.moduleCode === "TIM");
  const manuscript = await readFile(source.sourcePath, "utf8");
  const starts = source.editions.map(edition => manuscript.indexOf(edition.startMarker));
  const tools = await loadContentTools();
  try {
    for (const [index, edition] of source.editions.entries()) {
      const bytes = Buffer.from(manuscript.slice(starts[index], starts[index + 1] ?? manuscript.length));
      const adapted = await tools.adaptLearningSource(bytes, "MARKDOWN", "TIM", "1.0", edition.deliveryEdition, { title: "Time Lab™", slug: "time" });
      const artifact = await tools.compileLearningEdition(adapted, "TIM", "1.0", edition.deliveryEdition);
      const welcome = JSON.parse(artifact.content).treatment.pages[0].html;
      assert.equal([...welcome.matchAll(/<select\b/g)].length, 10);
      for (const option of ["Never", "Rarely", "Sometimes", "Often", "Always"]) {
        assert.equal([...welcome.matchAll(new RegExp(`value="${option}"`, "g"))].length, 10);
      }
    }
  } finally { await tools.dispose(); }
});
