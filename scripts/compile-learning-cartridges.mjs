import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const editions = ["school", "emerging_adult", "workplace"];
const expectedSourceIds = {
  school: "HAB-LM-1.4-S",
  emerging_adult: "HAB-LM-1.4-EA",
  workplace: "HAB-LM-1.4-WK",
};
const expectedContentHashes = {
  school: "6dc195c3fda4c3b4244615d233b3d2f3fcb46fce831af32c177928aa8dd4fb8e",
  emerging_adult: "7a465c61f8c4c2a9337d7c1ed117296cad52ffa47a7c98710ef48afe20ca8b57",
  workplace: "10e788c6fc4c76f6af4e1d1bfee62f44fa5f553433f93520caf27da60621bb2c",
};
const expectedFieldCounts = { school: 169, emerging_adult: 176, workplace: 170 };
const expectedPageKeys = ["Welcome", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Weekend", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Certificate"];
const assetManifest = {
  school: [
    "habit-school.part0.seg00",
    "habit-school.part0.seg01",
    "habit-school.part1.seg00",
    "habit-school.part1.seg01",
    "habit-school.part2.seg00",
    "habit-school.part2.seg01",
    "habit-school.part2.seg02",
    "habit-school.part2.seg03",
    "habit-school.part2.seg04",
    "habit-school.part2.seg05",
  ],
  emerging_adult: [
    "habit-emerging_adult.part0.seg00",
    "habit-emerging_adult.part0.seg01",
    "habit-emerging_adult.part0.seg02",
    "habit-emerging_adult.part0.seg03",
    "habit-emerging_adult.part0.seg04",
    "habit-emerging_adult.part0.seg05",
    "habit-emerging_adult.part0.seg06",
    "habit-emerging_adult.part1.seg00",
    "habit-emerging_adult.part1.seg01",
    "habit-emerging_adult.part2.seg00",
    "habit-emerging_adult.part2.seg01",
    "habit-emerging_adult.part2.seg02",
    "habit-emerging_adult.part2.seg03",
    "habit-emerging_adult.part2.seg04",
    "habit-emerging_adult.part2.seg05",
  ],
  workplace: [
    "habit-workplace.part0.seg00",
    "habit-workplace.part0.seg01",
    "habit-workplace.part1.seg00",
    "habit-workplace.part1.seg01",
    "habit-workplace.part2.seg00",
    "habit-workplace.part2.seg01",
    "habit-workplace.part3.seg00",
  ],
};

async function readProgramme(edition) {
  const parts = await Promise.all(
    assetManifest[edition].map((name) => readFile(resolve(`public/programmes/chunks/${name}`), "utf8")),
  );
  return JSON.parse(gunzipSync(Buffer.from(parts.join("").trim(), "base64")).toString("utf8"));
}

for (const edition of editions) {
  const programme = await readProgramme(edition);
  if (programme.schemaVersion !== "2.0" || programme.labCode !== "HAB" || programme.contentVersion !== "1.4") {
    throw new Error(`${edition}: invalid Habit programme contract`);
  }
  if (programme.edition !== edition) throw new Error(`${edition}: edition mismatch`);
  if (programme.treatment?.sourceId !== expectedSourceIds[edition]) throw new Error(`${edition}: canonical source ID changed`);
  if (programme.treatment?.contentHash !== expectedContentHashes[edition]) throw new Error(`${edition}: canonical content hash changed`);
  const pages = programme.treatment.pages;
  if (pages.length !== 13) throw new Error(`${edition}: expected 13 programme positions, received ${pages.length}`);
  if (JSON.stringify(pages.map((page) => page.key)) !== JSON.stringify(expectedPageKeys)) throw new Error(`${edition}: programme sequence changed`);
  const fieldIds = pages.flatMap((page) => [...page.html.matchAll(/data-field-id="([^"]+)"/g)].map((match) => match[1]));
  if (fieldIds.length !== expectedFieldCounts[edition]) throw new Error(`${edition}: workbook field count changed`);
  if (new Set(fieldIds).size !== fieldIds.length) throw new Error(`${edition}: duplicate workbook field ID`);
  if (fieldIds.some((field) => !/^HAB\.WB\.[A-Z0-9._-]+$/.test(field))) throw new Error(`${edition}: invalid workbook field namespace`);
  const learningResponseTags = pages.flatMap((page) => [...page.html.matchAll(/<textarea\b[^>]*data-purpose="LEARNING_RESPONSE"[^>]*>/g)].map((match) => match[0]));
  if (learningResponseTags.some((tag) => !/data-source-key="[a-z0-9-]+"/.test(tag))) throw new Error(`${edition}: workbook source-key binding is missing`);
  const day3 = pages.find((page) => page.key === "Day 3");
  if (!day3?.labHandoff || day3.phase !== "LAB") throw new Error(`${edition}: Day 3 must hand off to the executable Habit Lab`);
  if (!day3.html.includes('data-purpose="FORMAL_LAB_REFERENCE"') || !day3.html.includes('data-purpose="LEARNING_RESPONSE"')) throw new Error(`${edition}: Day 3 response ownership boundary changed`);
  const day8 = pages.find((page) => page.key === "Day 8")?.html ?? "";
  if (!day8.includes("N/A") || !day8.includes("Prediction Accuracy")) throw new Error(`${edition}: Day 8 zero-opportunity/calibration rules are missing`);
  if (edition === "workplace") {
    const welcome = pages.find((page) => page.key === "Welcome")?.html ?? "";
    if (!welcome.includes("CONFIDENTIALITY") && !welcome.includes("Confidentiality")) throw new Error("workplace: confidentiality notice is missing");
  }
  if (programme.sourceTrace.rule !== "Lossless authored handbook content. No summarisation or editorial compression.") throw new Error(`${edition}: source fidelity rule changed`);
}

console.log("Validated Habit programme: 3 editions × 13 programme positions with lossless handbook content.");
