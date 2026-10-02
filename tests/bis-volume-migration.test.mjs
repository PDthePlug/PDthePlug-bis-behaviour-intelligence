import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("supplied BIS volume corpus maps 32 distinct source-backed Labs by canonical code", async () => {
  const manifest = JSON.parse(await source("lib/bis-volume-migration-manifest.json"));
  assert.equal(manifest.sourceBackedLabCount, 32);
  assert.equal(manifest.entries.length, 32);
  assert.equal(new Set(manifest.entries.map((entry) => entry.code)).size, 32);
  assert.deepEqual(
    [1, 2, 3].map((volume) => manifest.entries.filter((entry) => entry.volume === volume).length),
    [12, 10, 10],
  );
  assert.equal(manifest.entries.some((entry) => entry.code === "FAI"), false);
  assert.equal(manifest.entries.some((entry) => entry.code === "CAR"), false);
});

test("Failure stays pending user source and Career is only outside this supplied volume corpus", async () => {
  const manifest = JSON.parse(await source("lib/bis-volume-migration-manifest.json"));
  const failure = manifest.outsideSuppliedVolumeCorpus.find((entry) => entry.code === "FAI");
  const career = manifest.outsideSuppliedVolumeCorpus.find((entry) => entry.code === "CAR");
  assert.match(failure.note, /Pending user source/);
  assert.match(failure.note, /Do not infer or manufacture content/);
  assert.match(career.note, /does not assert that no separate Career source exists/i);
});

test("source anomalies are represented rather than silently normalized", async () => {
  const manifest = JSON.parse(await source("lib/bis-volume-migration-manifest.json"));
  const purpose = manifest.entries.find((entry) => entry.code === "PUR");
  const resilience = manifest.entries.find((entry) => entry.code === "RES");
  assert.equal(purpose.sourceProductNumber, 12);
  assert.equal(resilience.sourceProductNumber, 12);

  const launch = manifest.entries.find((entry) => entry.code === "LCH");
  const growth = manifest.entries.find((entry) => entry.code === "GMN");
  assert.equal(launch.expectedLearnerCopies, 2);
  assert.equal(growth.expectedLearnerCopies, 2);
  assert.equal(launch.experimentDays, 30);

  const volume3 = manifest.entries.filter((entry) => entry.volume === 3);
  assert.equal(volume3.length, 10);
  assert.ok(volume3.every((entry) => entry.transferSubstage === 8.5));
  assert.ok(manifest.entries.every((entry) => entry.sourceInvestigation2 === "The Prediction"));
  assert.ok(manifest.entries.every((entry) => entry.canonicalInvestigation2 === "The Pattern"));
});

test("source order and catalogue order are separate identities", async () => {
  const manifest = JSON.parse(await source("lib/bis-volume-migration-manifest.json"));
  const catalogue = JSON.parse(await source("lib/bis-catalogue.json"));
  const byCode = new Map(catalogue.modules.map((entry) => [entry.code, entry]));
  for (const entry of manifest.entries) {
    const canonical = byCode.get(entry.code);
    assert.ok(canonical, entry.code + " exists in the canonical catalogue");
    assert.equal(entry.slug, canonical.slug);
    assert.equal(entry.title, canonical.title);
    assert.equal(entry.canonicalPosition, canonical.position);
  }
  assert.equal(manifest.entries.find((entry) => entry.code === "LCH").sourcePosition, 1);
  assert.equal(manifest.entries.find((entry) => entry.code === "LCH").canonicalPosition, 2);
});

test("volume adapter splits complete books without trusting product numbers as identities", async () => {
  const adapter = await source("lib/content-source-adapters.ts");
  assert.match(adapter, /adaptBisVolumeSource/);
  assert.match(adapter, /FIRST_COMPLETE_LEARNER_COPY/);
  assert.match(adapter, /hasNearbyProductClassification/);
  assert.match(adapter, /sourceProductNumber \+ "\(\?!\\\\d\)"/);
  assert.match(adapter, /missing learner source boundaries/);
  assert.match(adapter, /packageWithMigrationTrace/);
});

test("legacy Prediction and Volume 3 transfer normalization remain visible after compilation", async () => {
  const [standard, compiler] = await Promise.all([
    source("lib/universal-lab-standard.mjs"),
    source("lib/content-compiler.ts"),
  ]);
  assert.match(standard, /LEGACY_PREDICTION_STAGE/);
  assert.match(standard, /TRANSFER_SUBSTAGE_FOLDED/);
  assert.match(compiler, /sourceMigration/);
  assert.match(compiler, /normalizationNotes/);
});


test("Content Studio exposes a non-publishing whole-volume audit path", async () => {
  const [route, ui] = await Promise.all([
    source("app/api/content-studio/volume-audit/route.ts"),
    source("app/content-studio/content-studio.tsx"),
  ]);
  assert.match(route, /adaptBisVolumeSource/);
  assert.match(route, /compileUniversalLab/);
  assert.match(route, /SYSTEM_ADMIN/);
  assert.match(route, /editorialReviewLabs/);
  assert.match(route, /stageRequested/);
  assert.match(route, /content:lab:\$\{draft\.code\}:1\.0/);
  assert.match(route, /CONTENT_STUDIO_BUCKET/);
  assert.match(route, /sourceFormat: "BIS_PACKAGE_JSON"/);
  assert.match(route, /status: "DRAFT"/);
  assert.match(ui, /Audit a volume/);
  assert.match(ui, /Audit only/);
  assert.match(ui, /Stage into 1\.0 drafts/);
  assert.match(ui, /Nothing was published/);
  assert.match(ui, /Need strengthening/);
});

test("shared Lab frame gives legacy live Labs the same canonical stage layer", async () => {
  const frame = await source("app/lab-investigation-frame.tsx");
  assert.match(frame, /HABIT_LAB_STAGES/);
  assert.match(frame, /canonicalStage/);
  assert.match(frame, /<h1>{canonicalTitle}<\\/h1>/);
  assert.match(frame, /Investigation {step} of {total}/);
  assert.doesNotMatch(frame, /canonicalStage\\?\\.role/);
});
