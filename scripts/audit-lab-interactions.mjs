import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadContentTools } from "./lib/load-content-tools.mjs";
import { prepareUniversalLabPresentation, universalHtmlText, authoredQuestions } from "../lib/universal-lab-presentation.mjs";
import { availableLabPrompts, requiredLabPromptIds, validateLabSubmission } from "../lib/lab-interaction-contract.mjs";
import { universalExperimentEvidenceProgress } from "../lib/universal-lab-v2.mjs";
import { upgradeUniversalLabV2 } from "../lib/universal-lab-v2.mjs";

function answer(prompt) {
  if (prompt.type === "DATE") return "2026-10-03";
  if (prompt.type === "INTEGER") return String(prompt.min ?? 1);
  if (prompt.type === "BOOLEAN") return "No";
  if (prompt.type === "CATEGORICAL") return prompt.options[0];
  if (prompt.type === "MULTI_SELECT") return JSON.stringify([prompt.options[0]]);
  return "A specific observation from this activity.";
}

export function auditDefinition(raw, definition) {
  assert.deepEqual(prepareUniversalLabPresentation(definition), definition, "Client normalization must not change the API schema");
  const baselineIds = new Set(availableLabPrompts(definition, 0).map((prompt) => prompt.id));
  const summary = { code: definition.identity.code, baselineItems: definition.presentationBaseline?.items.length ?? 0, controls: 0, days: definition.experiment?.days ?? 0 };
  const responses = {};
  if (definition.factoryCapabilities?.facilitatorOnlyIndicatorCodes?.includes("TEI-09")) {
    assert.equal(definition.indicatorRegistry.find((item) => item.code === "TEI-09")?.status, "NOT_COLLECTED");
    assert.equal(definition.investigations[7].prompts.some((prompt) => /^Score \(1[–-]5\)/i.test(prompt.prompt)), false, "Facilitator rubric must not create learner score fields");
  }
  for (const investigation of definition.investigations) {
    const ids = new Set(investigation.prompts.map((prompt) => prompt.id));
    assert.equal(ids.size, investigation.prompts.length, "Prompt IDs must be unique");
    const represented = new Set(investigation.blocks.flatMap((block) => {
      if (block.type === "PROMPT") return [block.promptId];
      if (block.type === "INLINE") return block.segments.filter((part) => part.kind === "PROMPT").map((part) => part.promptId);
      if (block.type === "TABLE") return block.rows.flat().filter((cell) => ["PROMPT", "CHOICE"].includes(cell.kind)).map((cell) => cell.promptId);
      return [];
    }));
    for (const prompt of investigation.prompts) {
      assert.ok(represented.has(prompt.id), `${prompt.id} must have a rendered control`);
      if (prompt.type === "TEXT" && !prompt.readOnly) assert.ok(authoredQuestions(prompt.prompt).length <= 1, `${prompt.id} combines independent questions`);
      assert.ok(!baselineIds.has(prompt.id), "Baseline must not repeat inside Investigation 1");
    }
    // Numbered reflection questions and their separate writing lines must not
    // collapse merely because the printed answer markers have identical text.
    const original = raw.investigations.find((item) => item.number === investigation.number);
    for (let index = 0; index < (original?.blocks.length ?? 0) - 1; index++) {
      const block = original.blocks[index];
      if (block.type !== "HTML" || original.blocks[index + 1].type !== "PROMPT") continue;
      const paragraphs = [...block.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
      const match = universalHtmlText(paragraphs.at(-1)?.[1] ?? "").match(/^(\d+)\.\s+(.+\?)$/);
      if (!match) continue;
      for (const question of authoredQuestions(match[2])) assert.ok(investigation.prompts.some((prompt) => prompt.prompt === question), `Missing authored reflection: ${question}`);
    }
    summary.controls += ids.size;
  }
  if (definition.presentationBaseline) {
    const baseline = availableLabPrompts(definition, 0);
    assert.equal(new Set(baseline.map((prompt) => prompt.prompt)).size, baseline.length);
    validateLabSubmission(definition, 0, 0, baseline.map((prompt) => ({ semanticFieldId: prompt.id, value: answer(prompt) })));
  }
  for (const investigation of definition.investigations) {
    if (investigation.number === definition.experiment?.investigation) continue;
    const fields = availableLabPrompts(definition, investigation.number, 0).filter((prompt) => !prompt.readOnly);
    validateLabSubmission(definition, investigation.number, 0, fields.map((prompt) => ({ semanticFieldId: prompt.id, value: answer(prompt) })));
    validateLabSubmission(definition, investigation.number, 0, fields.map((prompt) => ({ semanticFieldId: prompt.id, responseStatus: "PASS" })));
  }
  for (let day = 1; day <= summary.days; day++) {
    const fields = availableLabPrompts(definition, 7, day).filter((prompt) => !prompt.readOnly);
    assert.ok(fields.length, `Day ${day} needs real evidence controls`);
    assert.ok(fields.every((prompt) => prompt.scheduleDay <= day && day <= (prompt.scheduleEndDay ?? prompt.scheduleDay)));
    assert.deepEqual(requiredLabPromptIds(definition, 7, day), fields.filter((prompt) => prompt.required !== false).map((prompt) => prompt.id));
    const saved = validateLabSubmission(definition, 7, day, fields.map((prompt) => ({ semanticFieldId: prompt.id, value: answer(prompt) })), responses);
    for (const item of saved) responses[item.semanticFieldId] = { value: item.value, status: item.responseStatus };
    const handoff = universalExperimentEvidenceProgress(definition, responses, day);
    assert.equal(handoff.todayEvidenceRecorded, true);
    assert.equal(handoff.evidenceDaysRecorded, new Set(definition.experiment.scheduledPromptIds.filter((entry) => entry.day <= day).map((entry) => entry.day)).size);
    if (day < summary.days && fields.every((prompt) => (prompt.scheduleEndDay ?? prompt.scheduleDay) === day)) assert.equal(universalExperimentEvidenceProgress(definition, responses, day + 1).todayEvidenceRecorded, false);
  }
  assert.equal(availableLabPrompts(definition, 7, summary.days + 1).filter((prompt) => !prompt.readOnly).length, 0, "Expired windows cannot be backfilled");
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = process.argv.slice(2);
  if (paths.length !== 3) throw new Error("Supply the Volume 1, Volume 2 and Volume 3 Word paths in that order.");
  const tools = await loadContentTools();
  try {
    let total = 0;
    const blockers = [];
    for (let volume = 1; volume <= 3; volume++) {
      const labs = await tools.adaptBisVolumeSource(await readFile(paths[volume - 1]), volume, "1.0");
      for (const lab of labs) {
        const raw = JSON.parse(new TextDecoder().decode(lab.packageBytes));
        let definition;
        try {
          const artifact = await tools.compileUniversalLab(lab.packageBytes, lab.code, "1.0");
          definition = prepareUniversalLabPresentation(JSON.parse(artifact.content));
        } catch (error) {
          blockers.push({ code: lab.code, gate: "COMPILER", error: error.message });
          definition = prepareUniversalLabPresentation(upgradeUniversalLabV2(raw));
        }
        try { console.log(JSON.stringify(auditDefinition(raw, definition))); }
        catch (error) { blockers.push({ code: lab.code, gate: "INTERACTION", error: error.message }); }
        total++;
      }
    }
    console.log(JSON.stringify({ auditedLabs: total, blockers }, null, 2));
    if (blockers.length) process.exitCode = 1;
    else console.log(`PASS: ${total} source-backed Labs through the actual adapter, compiler, presentation and save validator.`);
  } finally { await tools.dispose(); }
}
