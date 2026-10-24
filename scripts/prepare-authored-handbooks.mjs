import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { loadContentTools } from "./lib/load-content-tools.mjs";
import { applyApprovedHandbookRevision } from "./lib/apply-approved-handbook-revision.mjs";

// Offline preparation only. No database, learner records, publication or UAT writes.
const check = process.argv.includes("--check");
const root = new URL("../", import.meta.url);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const inventory = JSON.parse(await readFile(new URL("content/learning-sources/manifest.json", root)));
const catalogue = JSON.parse(await readFile(new URL("lib/bis-catalogue.json", root)));
const folder = new URL("content/learning-prepared/handbooks-20261024/", root);
const tools = await loadContentTools();
const careerRevision = JSON.parse(await readFile(new URL("content/learning-sources/career-30-day-approved-20261024.json", root)));
const launchRevision = JSON.parse(await readFile(new URL("content/learning-sources/launch-30-day-approved-20261024.json", root)));
async function retain(name, content) {
  if (check) assert.equal(await readFile(new URL(name, folder), "utf8"), content, `${name} differs from the actual shared compiler; prepare it again.`);
  else await writeFile(new URL(name, folder), content);
}
try {
  if (!check) await mkdir(folder, { recursive: true });
  const editions = [];
  for (const source of inventory.collections) {
    const bytes = await readFile(new URL(source.sourcePath, root));
    assert.equal(bytes.length, source.uploadedBytes, "The retained handbook manuscript size changed.");
    assert.equal(digest(bytes), source.uploadedSha256, "The retained handbook manuscript fingerprint changed.");
    const modules = catalogue.modules.filter(item => item.volume === source.volume);
    const parts = await tools.adaptLearningVolumeSource(bytes, modules, "0.0.0-intake.20261024", { partial: source.partial, volume: source.volume });
    assert.equal(parts.length, source.editions);
    for (const part of parts) {
      part.packageBytes = applyApprovedHandbookRevision(part.packageBytes, careerRevision);
      part.packageBytes = applyApprovedHandbookRevision(part.packageBytes, launchRevision);
      const artifact = await tools.compileLearningEdition(part.packageBytes, part.code, "0.0.0-intake.20261024", part.edition);
      const programme = JSON.parse(artifact.content);
      assert.equal(programme.treatment.pages.length, 13);
      const ids = programme.treatment.pages.flatMap(page => [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map(match => match[1]));
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.every(id => id.startsWith(`${part.code}.WB.${part.edition.toUpperCase()}.`)));
      const filename = `${part.code.toLowerCase()}-${part.edition}.json.gz.b64`;
      await retain(filename, gzipSync(part.packageBytes, { mtime: 0 }).toString("base64") + "\n");
      editions.push({ code: part.code, slug: part.slug, title: part.title, edition: part.edition, volume: source.volume,
        sourcePath: source.sourcePath, sourceSha256: source.uploadedSha256,
        sourceId: part.sourceId, sectionHash: part.sectionHash, sourceBlocks: part.sourceBlocks,
        asset: filename, packageHash: digest(part.packageBytes), artifactHash: artifact.hash,
        pages: programme.treatment.pages.length, fields: ids.length });
    }
  }
  const manifest = { schemaVersion: "1.0", status: "PREPARED_FOR_REVIEW", replacementScope: "All supplied titles and editions replace prior authored handbook content when published.",
    approvedRevisions: [careerRevision, launchRevision].map(revision => ({ code: revision.code, revision: revision.revision, sha256: digest(JSON.stringify(revision)), schedule: revision.experimentSchedule })),
    compilerVersion: tools.CONTENT_COMPILER_VERSION, runtimeVersion: "0.0.0-intake.20261024", editions };
  await retain("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${check ? "Verified" : "Prepared"} ${editions.length} handbook editions, ${editions.reduce((sum, item) => sum + item.pages, 0)} programme pages, ${editions.reduce((sum, item) => sum + item.fields, 0)} private response fields. Publication unchanged.`);
} finally { await tools.dispose(); }
