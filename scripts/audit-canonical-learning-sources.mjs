import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadContentTools } from "./lib/load-content-tools.mjs";

const manifestUrl = new URL("../content/learning-sources/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const expectedPageKeys = [
  "Welcome",
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Weekend",
  "Day 6",
  "Day 7",
  "Day 8",
  "Day 9",
  "Day 10",
  "Certificate",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function countLine(source, value) {
  const heading = value.replace(/^#+\s*/, "");
  return source.split("\n").filter((line) => line.trim().replace(/^#+\s*/, "") === heading).length;
}

const tools = await loadContentTools();
try {
  const compiled = [];
  for (const entry of manifest.sources ?? []) {
    const bytes = await readFile(new URL(`../${entry.sourcePath}`, import.meta.url));
    assert.equal(
      bytes.byteLength,
      entry.uploadedBytes,
      `${entry.moduleCode}: canonical Learning source byte length changed.`,
    );
    assert.equal(
      sha256(bytes),
      entry.uploadedSha256,
      `${entry.moduleCode}: canonical Learning source fingerprint changed.`,
    );

    const source = bytes.toString("utf8");
    const editions = entry.editions ?? [];
    const starts = editions.map((edition) => source.indexOf(edition.startMarker));
    assert.ok(starts.every((offset) => offset >= 0), `${entry.moduleCode}: one or more authored editions are missing.`);
    assert.deepEqual([...starts].sort((a, b) => a - b), starts, `${entry.moduleCode}: authored editions changed order.`);

    for (let index = 0; index < editions.length; index += 1) {
      const edition = editions[index];
      const section = source.slice(starts[index], starts[index + 1] ?? source.length);
      const sectionBytes = Buffer.from(section, "utf8");
      assert.equal(
        sha256(sectionBytes),
        edition.sha256,
        `${entry.moduleCode}/${edition.deliveryEdition}: authored edition fingerprint changed.`,
      );
      assert.ok(section.includes(`Volume ${entry.volume} — Handbook ${entry.handbook}`), `${entry.moduleCode}/${edition.deliveryEdition}: handbook identity missing.`);
      assert.ok(section.includes(`Version ${entry.version} — Learner Edition`), `${entry.moduleCode}/${edition.deliveryEdition}: authored version missing.`);
      assert.ok(section.includes(edition.sourceId), `${entry.moduleCode}/${edition.deliveryEdition}: source ID ${edition.sourceId} missing.`);

      for (const heading of [
        "# WELCOME",
        "# DAY 1",
        "# DAY 2",
        "# DAY 3 — PART A",
        "# DAY 3 — PART B",
        "# DAY 4",
        "# DAY 5",
        "# WEEKEND",
        "# DAY 6",
        "# DAY 7",
        "# DAY 8",
        "# DAY 9",
        "# DAY 10",
      ]) {
        assert.equal(
          countLine(section, heading),
          1,
          `${entry.moduleCode}/${edition.deliveryEdition}: expected exactly one authored "${heading}" programme boundary.`,
        );
      }

      const adaptedBytes = await tools.adaptLearningSource(
        sectionBytes,
        "MARKDOWN",
        entry.moduleCode,
        entry.version,
        edition.deliveryEdition,
        { title: entry.moduleTitle, slug: entry.slug },
      );
      const artifact = await tools.compileLearningEdition(
        adaptedBytes,
        entry.moduleCode,
        entry.version,
        edition.deliveryEdition,
      );
      const programme = JSON.parse(artifact.content);
      assert.deepEqual(
        programme.treatment.pages.map((page) => page.key),
        expectedPageKeys,
        `${entry.moduleCode}/${edition.deliveryEdition}: compiled programme order changed.`,
      );
      assert.equal(programme.treatment.pages.length, 13);
      assert.equal(programme.labCode, entry.moduleCode);
      assert.equal(programme.contentVersion, entry.version);
      assert.equal(programme.edition, edition.deliveryEdition);

      const dayThree = programme.treatment.pages.find((page) => page.key === "Day 3");
      assert.ok(dayThree, `${entry.moduleCode}/${edition.deliveryEdition}: Day 3 missing after compile.`);
      assert.match(dayThree.html, /DAY\s+3\s*[—-]\s*PART\s+A/i, `${entry.moduleCode}/${edition.deliveryEdition}: Day 3 Part A was lost.`);
      assert.match(dayThree.html, /DAY\s+3\s*[—-]\s*PART\s+B/i, `${entry.moduleCode}/${edition.deliveryEdition}: Day 3 Part B was lost.`);
      assert.ok(dayThree.labHandoff?.startMarker && dayThree.labHandoff?.endMarker, `${entry.moduleCode}/${edition.deliveryEdition}: governed Lab handoff markers missing.`);
      assert.equal(dayThree.labHandoff?.source, "AUTHORED", `${entry.moduleCode}/${edition.deliveryEdition}: authored Part B boundary was not retained as the Lab handoff.`);
      const handoffIndex = dayThree.html.indexOf(dayThree.labHandoff.startMarker);
      const partAIndex = dayThree.html.search(/DAY\s+3\s*[—-]\s*PART\s+A/i);
      const partBIndex = dayThree.html.search(/DAY\s+3\s*[—-]\s*PART\s+B/i);
      assert.ok(partAIndex >= 0 && handoffIndex > partAIndex, `${entry.moduleCode}/${edition.deliveryEdition}: Lab handoff must follow Part A.`);
      assert.ok(partBIndex >= 0 && handoffIndex < partBIndex, `${entry.moduleCode}/${edition.deliveryEdition}: Lab handoff must precede Part B.`);

      const fieldIds = programme.treatment.pages.flatMap((page) =>
        [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]),
      );
      assert.ok(fieldIds.length > 0, `${entry.moduleCode}/${edition.deliveryEdition}: no learner response controls were compiled.`);
      assert.equal(new Set(fieldIds).size, fieldIds.length, `${entry.moduleCode}/${edition.deliveryEdition}: duplicate workbook field IDs.`);
      assert.ok(
        fieldIds.every((id) => id.startsWith(`${entry.moduleCode}.WB.${edition.deliveryEdition.toUpperCase()}.`)),
        `${entry.moduleCode}/${edition.deliveryEdition}: workbook field escaped its private edition namespace.`,
      );

      compiled.push({
        code: entry.moduleCode,
        edition: edition.deliveryEdition,
        pages: programme.treatment.pages.length,
        controls: fieldIds.length,
        artifactHash: artifact.hash,
      });
    }
  }

  console.log(JSON.stringify({ canonicalLearningSources: manifest.sources?.length ?? 0, compiled }, null, 2));
  console.log(
    `PASS: ${compiled.length} authored Learning editions through the actual BIS source adapter and content compiler.`,
  );
} finally {
  await tools.dispose();
}
