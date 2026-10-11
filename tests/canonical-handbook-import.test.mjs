import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const dir = new URL("../public/handbooks/canonical/", import.meta.url);
let names = [];
try { names = await readdir(dir); } catch {}
if (!names.includes("manifest.json")) {
  test("canonical handbook packages are generated from the authoritative DOCX", { skip: "Run scripts/import-canonical-handbooks.py with the original DOCX first." }, () => {});
} else {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", dir), "utf8"));
  test("manifest records immutable source provenance and all discovered editions", () => {
    assert.equal(manifest.source.preserved, true);
    assert.equal(manifest.source.sha256, "1bfd88d11bf90ebbe3b7f40321740904e8a8065d3e5294978ffd8a2cbb2b356e");
    assert.equal(manifest.editionCount, 30, "review source boundary changes rather than silently changing the catalogue");
    assert.equal(manifest.editions.filter(e => e.sourceHeadingType === "malformed-prefix").length, 1);
    assert.equal(manifest.editions.filter(e => e.family === "TIME").length, 4, "retain the duplicate/malformed Time boundary as source evidence");
    assert.equal(manifest.editions.filter(e => e.family === "RISK").length, 2, "do not invent a missing Risk Workplace edition");
    assert.match(manifest.source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.editionCount, manifest.editions.length);
    assert.equal(new Set(manifest.editions.map(e => `${e.family}:${e.audience}:${e.ordinalInFamily}`)).size, manifest.editions.length);
  });
  for (const edition of manifest.editions) test(`${edition.family} / ${edition.audience}: ordered source blocks and provenance`, async () => {
    const pkg = JSON.parse(await readFile(new URL(edition.asset, dir), "utf8"));
    assert.equal(pkg.schemaVersion, "canonical-handbook/1");
    assert.equal(pkg.source.sha256, manifest.source.sha256);
    assert.equal(pkg.edition.family, edition.family);
    assert.equal(pkg.edition.audience, edition.audience);
    assert.equal(pkg.blocks.length, edition.blockCount);
    const ids = pkg.blocks.map(block => Number(block.id.slice(1)));
    assert.ok(ids.every(Number.isInteger));
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "block order must match source order");
    assert.ok(pkg.blocks.every(block => block.type === "paragraph"
      ? typeof block.text === "string"
      : block.type === "table" && Array.isArray(block.rows)));
  });
}
