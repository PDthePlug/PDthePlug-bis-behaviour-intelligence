import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { loadContentTools } from "./lib/load-content-tools.mjs";
import { prepareUniversalLabPresentation } from "../lib/universal-lab-presentation.mjs";
import { auditDefinition } from "./audit-lab-interactions.mjs";

// Input is an authorized export of active artifact metadata and downloaded bytes.
// It never writes UAT approval records or changes content activations.
const exportPath = process.argv[2];
if (!exportPath) throw Error("Supply an active-artifact export JSON: [{code,versionId,path,sha256}].");
const exported = JSON.parse(await readFile(exportPath, "utf8"));
assert.ok(Array.isArray(exported) && exported.length, "The active export cannot be empty");
const manifest = JSON.parse(await readFile("content/sources/manifest.json", "utf8"));
const tools = await loadContentTools();
const canonical = new Map();
const results = [];
const semanticKey = prompt => [prompt.prompt.trim().toLowerCase().replace(/\s+/g, " "), prompt.type, prompt.scheduleDay ?? 0, prompt.scheduleEndDay ?? 0].join("|");
try {
  for (const source of manifest) {
    const bytes = await readFile(source.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
    for (const lab of await tools.adaptBisVolumeSource(bytes, source.volume, "1.0")) {
      const raw = JSON.parse(new TextDecoder().decode(lab.packageBytes));
      const compiled = await tools.compileUniversalLab(lab.packageBytes, lab.code, "1.0");
      canonical.set(lab.code, { raw, definition: prepareUniversalLabPresentation(JSON.parse(compiled.content)) });
    }
  }
  assert.equal(new Set(exported.map(item => item.code)).size, exported.length, "Duplicate active Lab codes in export");
  for (const item of exported) {
    try {
      assert.ok(item.versionId && /^[a-f0-9]{64}$/.test(item.sha256), "Exact version and SHA-256 are mandatory");
      const bytes = await readFile(resolve(dirname(exportPath), item.path));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, "Active artifact fingerprint mismatch");
      const active = prepareUniversalLabPresentation(JSON.parse(bytes));
      assert.equal(active.identity.code, item.code);
      const source = canonical.get(item.code);
      assert.ok(source, "No canonical source for active Lab");
      auditDefinition(source.raw, active);
      const stages = definition => [{ number: 0, prompts: [...(definition.presentationBaseline?.items ?? []), ...(definition.presentationBaseline?.metric ? [definition.presentationBaseline.metric] : [])] }, ...definition.investigations];
      const activeStages = new Map(stages(active).map(stage => [stage.number, stage.prompts]));
      for (const stage of stages(source.definition)) {
        const present = new Map();
        for (const prompt of activeStages.get(stage.number) ?? []) {
          const key = semanticKey(prompt);
          present.set(key, (present.get(key) ?? 0) + 1);
        }
        for (const prompt of stage.prompts.filter(prompt => !prompt.readOnly)) {
          const key = semanticKey(prompt);
          assert.ok(present.get(key) > 0, `Investigation ${stage.number}: missing source interaction ${prompt.prompt}`);
          present.set(key, present.get(key) - 1);
        }
      }
      results.push({ code: item.code, versionId: item.versionId, sha256: item.sha256, status: "PASS" });
    } catch (error) { results.push({ code: item.code, versionId: item.versionId, status: "FAIL", reason: error.message }); }
  }
  console.log(JSON.stringify({ certifiedArtifacts: results, uatApproval: "NOT_GRANTED_BY_THIS_AUDIT" }, null, 2));
  if (results.some(result => result.status === "FAIL")) process.exitCode = 1;
} finally { await tools.dispose(); }
