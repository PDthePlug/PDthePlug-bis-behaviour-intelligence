import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadContentTools } from "./lib/load-content-tools.mjs";
import { learnerCalculationContexts } from "../lib/learner-calculation-context.mjs";
import { prepareUniversalLabPresentation } from "../lib/universal-lab-presentation.mjs";

const tools = await loadContentTools();
const accepted = JSON.parse(await readFile("docs/hardening/metric-register.json", "utf8"));
const labs = [];
try {
  for (const volume of JSON.parse(await readFile("content/sources/manifest.json", "utf8"))) {
    const bytes = await readFile(volume.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), volume.sha256);
    for (const source of await tools.adaptBisVolumeSource(bytes, volume.volume, "audit-source")) {
      const artifact = await tools.compileUniversalLab(source.packageBytes, source.code, "audit-source");
      assert.equal(artifact.hash, accepted.labs.find(lab => lab.code === source.code).artifactHash, "Accepted compiler artifact changed");
      const definition = prepareUniversalLabPresentation(JSON.parse(artifact.content));
      const original = JSON.stringify(definition);
      const contexts = learnerCalculationContexts(definition);
      assert.deepEqual(contexts.map(context => context.id), definition.computedFields.map(field => field.id));
      for (const context of contexts) {
        const computation = definition.computedFields.find(field => field.id === context.id);
        assert.deepEqual(context.sources.map(input => input.id), computation.inputs);
        assert.doesNotMatch(JSON.stringify(context), /\b(?:BEI|TEI)-\d{2}|undefined/);
      }
      assert.equal(JSON.stringify(definition), original, "Context generation changed the published contract");
      labs.push({ code: source.code, sourcePath: volume.path, sourceHash: volume.sha256, artifactHash: artifact.hash, contexts });
    }
  }
  const result = { boundary: "Canonical source and accepted compiler artifact identities; source-derived learner explanations. This is not certification of every live Lab/version or a manual review of every interpretation.", result: "PASS", labs };
  await writeFile("docs/hardening/calculation-context-register.json", JSON.stringify(result, null, 2) + "\n");
  console.log({ result: result.result, labs: labs.length, calculations: labs.reduce((count, lab) => count + lab.contexts.length, 0), preservedArtifacts: true, preservedInputOrder: true });
} finally { await tools.dispose(); }
