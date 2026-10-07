import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadContentTools } from "./lib/load-content-tools.mjs";

const manifestUrl = new URL("../content/learning-sources/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const timeBlueprint = JSON.parse(await readFile(new URL("../content/curriculum/time/time-instructional-blueprint-v2.json", import.meta.url), "utf8"));
const timeEvidenceMap = JSON.parse(await readFile(new URL("../content/curriculum/time/time-competency-evidence-map.json", import.meta.url), "utf8"));
const timeV2Anchors = [...new Set([
  ...timeBlueprint.days.flatMap((day) => day.evidence.map((item) => item.anchor)),
  ...(timeEvidenceMap.bindings ?? []).map((item) => item.anchor),
])];
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
  return source.split("\n").filter((line) => line.trim() === value).length;
}

const tools = await loadContentTools();
try {
  const compiled = [];
  for (const entry of manifest.sources ?? []) {
    const bytes = await readFile(new URL(`../${entry.sourcePath}`, import.meta.url));
    const computedSourceSha256 = sha256(bytes);
    const source = bytes.toString("utf8");
    const editions = entry.editions ?? [];
    const starts = editions.map((edition) => source.indexOf(edition.startMarker));
    const computedEditions = editions.map((edition, index) => {
      const section = source.slice(starts[index], starts[index + 1] ?? source.length);
      return {
        deliveryEdition: edition.deliveryEdition,
        sha256: sha256(Buffer.from(section, "utf8")),
        bytes: Buffer.byteLength(section, "utf8"),
      };
    });
    console.log(JSON.stringify({
      sourceId: entry.moduleCode + "-LM-" + entry.version,
      sourcePath: entry.sourcePath,
      uploadedBytes: bytes.byteLength,
      uploadedSha256: sha256(bytes),
      editions: computedEditions,
    }, null, 2));
    assert.equal(
      bytes.byteLength,
      entry.uploadedBytes,
      `${entry.moduleCode}: canonical Learning source byte length changed.`,
    );
    assert.equal(
      computedSourceSha256,
      entry.uploadedSha256,
      `${entry.moduleCode}: canonical Learning source fingerprint changed.`,
    );
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
      assert.ok(section.includes(`**Volume ${entry.volume} — Handbook ${entry.handbook}**`), `${entry.moduleCode}/${edition.deliveryEdition}: handbook identity missing.`);
      assert.ok(section.includes(`Version ${entry.version} — Learner Edition`), `${entry.moduleCode}/${edition.deliveryEdition}: authored version missing.`);
      assert.ok(section.includes(edition.sourceId), `${entry.moduleCode}/${edition.deliveryEdition}: source ID ${edition.sourceId} missing.`);

      if (entry.moduleCode === "TIM" && entry.version === "2.0") {
        assert.match(section, /Your 45-Minute Learning Route/, `${entry.moduleCode}/${edition.deliveryEdition}: v2 learning route missing.`);
        assert.doesNotMatch(section, /TIME:\s*60 minutes/, `${entry.moduleCode}/${edition.deliveryEdition}: Day 1 still declares a 60-minute learning session.`);
        assert.match(section, /Separate Facilitated Lab Experience/, `${entry.moduleCode}/${edition.deliveryEdition}: separate Day 3 Lab boundary missing.`);
        assert.match(section, /# Time Leverage and Protection/, `${entry.moduleCode}/${edition.deliveryEdition}: Day 8 leverage layer missing.`);
        for (const anchor of timeV2Anchors) {
          assert.equal(
            section.split(`<!-- BIS:EVIDENCE ${anchor} -->`).length - 1,
            1,
            `${entry.moduleCode}/${edition.deliveryEdition}: expected exactly one authored evidence anchor ${anchor}.`,
          );
        }
      }

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
      assert.match(dayThree.html, /The Time Pause/i, `${entry.moduleCode}/${edition.deliveryEdition}: Day 3 Part A was lost.`);
      assert.match(dayThree.html, /Your Experiment Begins/i, `${entry.moduleCode}/${edition.deliveryEdition}: Day 3 Part B was lost.`);
      assert.ok(dayThree.labHandoff?.startMarker && dayThree.labHandoff?.endMarker, `${entry.moduleCode}/${edition.deliveryEdition}: governed Lab handoff markers missing.`);
      assert.equal(dayThree.labHandoff?.source, "AUTHORED", `${entry.moduleCode}/${edition.deliveryEdition}: authored Part B boundary was not retained as the Lab handoff.`);
      const handoffIndex = dayThree.html.indexOf(dayThree.labHandoff.startMarker);
      const partAIndex = dayThree.html.search(/The Time Pause/i);
      const partBIndex = dayThree.html.search(/Your Experiment Begins/i);
      assert.ok(partAIndex >= 0 && handoffIndex > partAIndex, `${entry.moduleCode}/${edition.deliveryEdition}: Lab handoff must follow Part A.`);
      assert.ok(partBIndex >= 0 && handoffIndex < partBIndex, `${entry.moduleCode}/${edition.deliveryEdition}: Lab handoff must precede Part B.`);

      const fieldIds = programme.treatment.pages.flatMap((page) =>
        [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]),
      );
      if (entry.moduleCode === "TIM" && entry.version === "2.0") {
        const compiledAnchors = programme.treatment.pages.flatMap((page) =>
          [...page.html.matchAll(/data-evidence-anchor="([^"]+)"/g)].map((match) => match[1]),
        );
        assert.equal(new Set(compiledAnchors).size, timeV2Anchors.length, `${entry.moduleCode}/${edition.deliveryEdition}: compiled evidence-anchor coverage changed.`);
        for (const anchor of timeV2Anchors) {
          assert.equal(compiledAnchors.filter((item) => item === anchor).length, 1, `${entry.moduleCode}/${edition.deliveryEdition}: compiled evidence anchor ${anchor} must bind exactly one learner control.`);
        }
      }
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
