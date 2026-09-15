import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const editions = ["school", "emerging_adult", "workplace"];
const expectedFields = { school: 169, emerging_adult: 176, workplace: 170 };
const expectedSource = { school: "HAB-LM-1.4-S", emerging_adult: "HAB-LM-1.4-EA", workplace: "HAB-LM-1.4-WK" };
const expectedHashes = {
  school: "6dc195c3fda4c3b4244615d233b3d2f3fcb46fce831af32c177928aa8dd4fb8e",
  emerging_adult: "7a465c61f8c4c2a9337d7c1ed117296cad52ffa47a7c98710ef48afe20ca8b57",
  workplace: "10e788c6fc4c76f6af4e1d1bfee62f44fa5f553433f93520caf27da60621bb2c",
};
const expectedKeys = ["Welcome", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Weekend", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Certificate"];

const assetManifest = {
  school: ["habit-school.part0.seg00", "habit-school.part0.seg01", "habit-school.part1.seg00", "habit-school.part1.seg01", "habit-school.part2.seg00", "habit-school.part2.seg01", "habit-school.part2.seg02", "habit-school.part2.seg03", "habit-school.part2.seg04", "habit-school.part2.seg05"],
  emerging_adult: ["habit-emerging_adult.part0.seg00", "habit-emerging_adult.part0.seg01", "habit-emerging_adult.part0.seg02", "habit-emerging_adult.part0.seg03", "habit-emerging_adult.part0.seg04", "habit-emerging_adult.part0.seg05", "habit-emerging_adult.part0.seg06", "habit-emerging_adult.part1.seg00", "habit-emerging_adult.part1.seg01", "habit-emerging_adult.part2.seg00", "habit-emerging_adult.part2.seg01", "habit-emerging_adult.part2.seg02", "habit-emerging_adult.part2.seg03", "habit-emerging_adult.part2.seg04", "habit-emerging_adult.part2.seg05"],
  workplace: ["habit-workplace.part0.seg00", "habit-workplace.part0.seg01", "habit-workplace.part1.seg00", "habit-workplace.part1.seg01", "habit-workplace.part2.seg00", "habit-workplace.part2.seg01", "habit-workplace.part3.seg00"],
};

async function programme(edition) {
  const parts = await Promise.all(assetManifest[edition].map((name) => readFile(new URL(`../public/programmes/chunks/${name}`, import.meta.url), "utf8")));
  return JSON.parse(gunzipSync(Buffer.from(parts.join("").trim(), "base64")).toString("utf8"));
}

test("Habit is a lossless 13-position programme in all three editions", async () => {
  for (const edition of editions) {
    const value = await programme(edition);
    assert.equal(value.schemaVersion, "2.0");
    assert.equal(value.edition, edition);
    assert.equal(value.sourceTrace.rule, "Lossless authored handbook content. No summarisation or editorial compression.");
    assert.deepEqual(value.treatment.pages.map((page) => page.key), expectedKeys);
    assert.equal(value.treatment.sourceId, expectedSource[edition]);
    assert.equal(value.treatment.contentHash, expectedHashes[edition]);
    assert.equal(value.treatment.pages.flatMap((page) => [...page.html.matchAll(/data-field-id="([^"]+)"/g)]).length, expectedFields[edition]);
  }
});

test("programme clock and experiment clock remain distinct", async () => {
  const value = await programme("emerging_adult");
  const page = (key) => value.treatment.pages.find((item) => item.key === key);
  assert.equal(page("Day 3").programmeDay, 3);
  assert.match(page("Day 3").experimentPosition, /Day 1 of 7/);
  assert.equal(page("Weekend").programmeDay, null);
  assert.equal(page("Weekend").experimentPosition, "Days 4–5 of 7");
  assert.equal(page("Day 7").programmeDay, 7);
  assert.equal(page("Day 7").experimentPosition, "Day 7 of 7");
  assert.equal(page("Day 8").experimentPosition, "Complete");
});

test("Day 3 separates learning responses from the formal Lab record", async () => {
  for (const edition of editions) {
    const day3 = (await programme(edition)).treatment.pages.find((item) => item.key === "Day 3");
    assert.equal(day3.phase, "LAB");
    assert.ok(day3.labHandoff);
    assert.match(day3.html, /data-purpose="FORMAL_LAB_REFERENCE"/);
    assert.match(day3.html, /data-purpose="LEARNING_RESPONSE"/);
  }
});

test("all digital workbook fields are stable private learning-response IDs with source keys", async () => {
  for (const edition of editions) {
    const value = await programme(edition);
    const tags = value.treatment.pages.flatMap((page) => [...page.html.matchAll(/<textarea\b[^>]*data-field-id="[^"]+"[^>]*>/g)].map((match) => match[0]));
    const fields = tags.map((tag) => ({
      id: tag.match(/data-field-id="([^"]+)"/)?.[1] ?? "",
      sourceKey: tag.match(/data-source-key="([^"]+)"/)?.[1] ?? "",
      purpose: tag.match(/data-purpose="([^"]+)"/)?.[1] ?? "",
      privacyClass: tag.match(/data-privacy-class="([^"]+)"/)?.[1] ?? "",
    }));
    assert.equal(new Set(fields.map((field) => field.id)).size, fields.length);
    for (const field of fields) {
      assert.match(field.id, /^HAB\.WB\.[A-Z0-9._-]+$/);
      assert.equal(field.privacyClass, "P3");
      if (field.purpose === "LEARNING_RESPONSE") assert.match(field.sourceKey, /^[a-z0-9-]+$/);
    }
  }
});

test("Day 8 retains N/A zero-opportunity logic and calibration formula", async () => {
  for (const edition of editions) {
    const html = (await programme(edition)).treatment.pages.find((item) => item.key === "Day 8").html;
    assert.match(html, /N\/A/);
    assert.match(html, /Prediction Accuracy/);
    assert.match(html, /100/);
  }
});

test("Workplace programme retains its confidentiality architecture", async () => {
  const welcome = (await programme("workplace")).treatment.pages.find((item) => item.key === "Welcome").html;
  assert.match(welcome, /CONFIDENTIALITY|Confidentiality/);
  assert.match(welcome, /manager|employer/i);
});

test("programme handoff opens focused Habit routes and preserves programme continuity", async () => {
  const [playerSource, bridgeSource, rootSource, labShellSource, menuSource, assetRouteSource] = await Promise.all([
    readFile(new URL("../app/learning/programme-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/habit-route-bridge.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/habit-lab/habit-lab-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/habit-lab/focused-learner-menu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/programmes/[asset]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(playerSource, /\/habit-lab\?returnTo=%2Fhabit/);
  assert.match(playerSource, /\/habit-lab\/experiment\?returnTo=%2Fhabit/);
  assert.match(rootSource, /view === "lab"[\s\S]*redirect\("\/habit-lab"\)/);
  assert.match(rootSource, /view === "experiment"[\s\S]*redirect\("\/habit-lab\/experiment"\)/);
  assert.match(bridgeSource, /lab: "My Lab"/);
  assert.match(bridgeSource, /experiment: "Today"/);
  assert.match(labShellSource, /HabitRouteBridge target=\{view\} hideReturnLink/);
  assert.match(menuSource, /href="\/habit"/);
  assert.match(menuSource, /href="\/habit\?section=learn"/);
  assert.match(playerSource, /\/programmes\/habit-\$\{edition\}\.json\.gz\.b64/);
  assert.match(assetRouteSource, /habit-school\.json\.gz\.b64/);
  assert.match(assetRouteSource, /habit-emerging_adult\.json\.gz\.b64/);
  assert.match(assetRouteSource, /habit-workplace\.json\.gz\.b64/);
});
