import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";
import { loadStaticLearningPackage } from "../lib/static-learning-package.mjs";
const tools = await loadContentTools();
test.after(() => tools.dispose());
const encode = value => new TextEncoder().encode(JSON.stringify(value));
const decode = bytes => JSON.parse(new TextDecoder().decode(bytes));

for (const edition of ["school", "emerging_adult", "workplace"]) {
  test(`${edition}: an immutable published-source copy compiles at the next version without changing authored pages or controls`, async () => {
    const source = encode(await loadStaticLearningPackage("habit", edition));
    const original = decode(source);
    const previous = original.identity?.version || original.contentVersion;
    const next = tools.copyPublishedPackageVersion(source, "HAB", previous, "copy-verification");
    const copied = decode(next);
    if (copied.identity?.version) copied.identity.version = previous;
    if (copied.contentVersion) copied.contentVersion = previous;
    assert.deepEqual(copied, original, "Only the envelope version may change");
    assert.deepEqual(decode(source), original, "The original bytes are immutable");
    const compiled = await tools.compileLearningEdition(next, "HAB", "copy-verification", edition);
    const prior = await tools.compileLearningEdition(source, "HAB", previous, edition);
    assert.deepEqual(decode(new TextEncoder().encode(compiled.content)).treatment.pages, decode(new TextEncoder().encode(prior.content)).treatment.pages);
    await assert.rejects(tools.compileLearningEdition(source, "HAB", "copy-verification", edition), /does not match/, "Normal uploaded package validation stays strict");
  });
}
test("a canonical Lab copy compiles with all investigation, calculation and evidence identities retained", async () => {
  const drafts = await tools.adaptBisVolumeSource(await readFile(new URL("../content/sources/volume-1.docx", import.meta.url)), 1, "copy-prior");
  const source = drafts.find(draft => decode(draft.packageBytes).identity.code === "HAB").packageBytes;
  const next = tools.copyPublishedPackageVersion(source, "HAB", "copy-prior", "copy-next");
  const copied = decode(next);
  const original = decode(source);
  assert.equal(copied.identity.version, "copy-next");
  copied.identity.version = "copy-prior";
  assert.deepEqual(copied, original);
  const compiled = decode(new TextEncoder().encode((await tools.compileUniversalLab(next, "HAB", "copy-next")).content));
  const prior = decode(new TextEncoder().encode((await tools.compileUniversalLab(source, "HAB", "copy-prior")).content));
  assert.deepEqual(compiled.investigations, prior.investigations);
  assert.deepEqual(compiled.computedFields, prior.computedFields);
  assert.deepEqual(compiled.experiment, prior.experiment);
  await assert.rejects(tools.compileUniversalLab(source, "HAB", "copy-next"), /does not match/);
});
test("source copying rejects wrong titles, inconsistent identity versions and unsafe version names", () => {
  const source = encode({ identity: { code: "HAB", version: "1.0" }, contentVersion: "1.0" });
  assert.throws(() => tools.copyPublishedPackageVersion(source, "MON", "1.0", "1.1"), /title/);
  assert.throws(() => tools.copyPublishedPackageVersion(source, "HAB", "0.9", "1.1"), /recorded version/);
  assert.throws(() => tools.copyPublishedPackageVersion(encode({ identity: { code: "HAB", version: "1.0" }, contentVersion: "0.9" }), "HAB", "1.0", "1.1"), /recorded version/);
  for (const next of ["1.0", "../1.1", "", "x".repeat(33)]) assert.throws(() => tools.copyPublishedPackageVersion(source, "HAB", "1.0", next), /safe version/);
});
