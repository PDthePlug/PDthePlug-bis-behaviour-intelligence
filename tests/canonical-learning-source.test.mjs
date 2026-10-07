import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile("content/learning-sources/manifest.json", "utf8"));
const catalogue = JSON.parse(await readFile("lib/bis-catalogue.json", "utf8"));

test("Time Learning source is canonical, three-edition and source-ready", async () => {
  const source = manifest.sources.find((item) => item.moduleCode === "TIM");
  assert.ok(source);
  assert.equal(source.version, "1.0");
  assert.deepEqual(
    source.editions.map((item) => item.deliveryEdition),
    ["school", "emerging_adult", "workplace"],
  );
  const bytes = await readFile(source.sourcePath);
  assert.equal(bytes.byteLength, 479151);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "706491b535deb8f64a4393a762e657f77b2773e3087640a719aa4248b99b245d",
  );
  const text = bytes.toString("utf8");
  for (const id of ["TIM-LM-1.0-S", "TIM-LM-1.0-EA", "TIM-LM-1.0-W"]) {
    assert.ok(text.includes(id), `${id} missing from canonical source`);
  }
  for (const edition of source.editions) {
    assert.match(edition.sha256, /^[a-f0-9]{64}$/);
  }

  const tim = catalogue.modules.find((item) => item.code === "TIM");
  assert.ok(tim);
  assert.equal(tim.learningStatus, "source_ready");
  assert.equal(tim.learningHref, null);
  assert.equal(tim.labStatus, "source_ready");
  assert.equal(tim.labHref, null);
});

test("shared Learning adapter preserves first boundary for multi-part programme days", async () => {
  const adapter = await readFile("lib/content-source-adapters.ts", "utf8");
  assert.ok(adapter.includes("PART\\s+[AB]"));
  assert.ok(adapter.includes("seenFallbackKeys"));
  assert.ok(adapter.includes("!seenFallbackKeys.has(key)"));
  assert.ok(adapter.includes("authoredDayThreePartB"));
  assert.ok(adapter.includes("AUTHORED_LAB_HANDOFF_START"));
});


test("Time Learning v2 is a separate instructional rebuild with authored evidence anchors", async () => {
  const source = manifest.sources.find((item) => item.moduleCode === "TIM" && item.version === "2.0");
  assert.ok(source);
  assert.equal(source.sourcePath, "content/learning-sources/time-v2.0-authored.md");
  assert.equal(source.provenance?.derivedFromSourceId, "TIM-LM-1.0");
  assert.deepEqual(
    source.editions.map((item) => item.deliveryEdition),
    ["school", "emerging_adult", "workplace"],
  );

  const text = await readFile(source.sourcePath, "utf8");
  for (const id of ["TIM-LM-2.0-S", "TIM-LM-2.0-EA", "TIM-LM-2.0-W"]) {
    assert.ok(text.includes(id), `${id} missing from Time v2 canonical source`);
  }
  assert.equal((text.match(/Your 45-Minute Learning Route/g) ?? []).length, 30);
  assert.equal((text.match(/Separate Facilitated Lab Experience/g) ?? []).length, 3);
  assert.equal((text.match(/# Time Leverage and Protection/g) ?? []).length, 3);
  assert.equal((text.match(/<!-- BIS:EVIDENCE /g) ?? []).length, 75);
  assert.doesNotMatch(text, /TIM-LM-1\.0-(S|EA|W)/);
});

test("Learning adapter compiles authored evidence markers onto learner controls", async () => {
  const adapter = await readFile("lib/content-source-adapters.ts", "utf8");
  assert.ok(adapter.includes("BIS:EVIDENCE"));
  assert.ok(adapter.includes("evidenceAnchor?: string"));
  assert.ok(adapter.includes("data-evidence-anchor"));
  assert.ok(adapter.includes("consumeEvidenceAnchor"));
});
