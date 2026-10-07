import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { productionSession } from "./hardening-production-session.mjs";
import { learnerCalculationContexts } from "../lib/learner-calculation-context.mjs";
import { prepareUniversalLabPresentation } from "../lib/universal-lab-presentation.mjs";

const admin = await productionSession("SYSTEM_ADMIN");
const { admin: configuration } = await admin.request("/api/staff");
const learner = await productionSession("LEARNER");
const labs = [], findings = [];
for (const published of configuration.publishedLabs) {
  const state = await learner.request(`/api/universal-lab?lab=${encodeURIComponent(published.code)}`);
  const raw = state.definition;
  assert.ok(raw && state.version === published.version);
  const sourceIdentity = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  const definition = prepareUniversalLabPresentation(raw);
  const contexts = learnerCalculationContexts(definition);
  const prompts = new Map([...(definition.presentationBaseline?.items ?? []), ...(definition.presentationBaseline?.metric ? [definition.presentationBaseline.metric] : []), ...definition.investigations.flatMap(stage => stage.prompts ?? [])].map(prompt => [prompt.id, prompt]));
  const calculated = new Map((definition.computedFields ?? []).map(field => [field.id, field]));
  const calculations = [...calculated.values()].map(field => {
    const context = contexts.find(item => item.id === field.id);
    if (!context) findings.push({ code: published.code, version: state.version, fieldId: field.id, issue: "No defined learner calculation context" });
    const sources = field.inputs.map(id => {
      const prompt = prompts.get(id), derived = calculated.get(id);
      if (!prompt && !derived) findings.push({ code: published.code, version: state.version, fieldId: field.id, inputId: id, issue: "Input has no published prompt/calculation binding" });
      return { id, label: prompt?.label ?? derived?.label ?? null, type: prompt?.type ?? (derived ? "DERIVED" : "UNBOUND"), scale: prompt?.min !== undefined ? { min: prompt.min, max: prompt.max } : null, sensitivity: prompt?.sensitivity ?? null };
    });
    return { id: field.id, operation: field.operation, sources, calculation: context?.calculation ?? null, interpretation: context?.meaning ?? null,
      practicalMeaning: "Review the named original inputs, missing values and task context before using this result in reflection or a human assessment. It does not establish programme causation or assessed competence." };
  });
  const indicators = (definition.indicatorRegistry ?? []).map(indicator => ({ code: indicator.code, status: indicator.status, primaryPromptId: indicator.primaryPromptId, sourceFields: indicator.promptIds }));
  for (const indicator of indicators) if (indicator.status === "UNBOUND") findings.push({ code: published.code, version: state.version, indicator: indicator.code, issue: "Unbound published indicator" });
  labs.push({ code: published.code, version: state.version, definitionSnapshotSha256: sourceIdentity, calculations, indicators,
    manualInterpretationReview: "PENDING; defined source/calculation/context does not certify every practical interpretation or learner state" });
  console.log({ code: published.code, version: state.version, calculations: calculations.length, indicators: indicators.length });
}
const report = { observedAt: new Date().toISOString(), projectRef: "swmhsqivqaqwovojbceo", originalLearnerValuesReturned: false,
  scope: "Current published production definitions retrieved through an authorised QA learner; source metadata only. No source is recompiled or republished, and original learner responses are not captured.",
  labs, findings, calculations: labs.reduce((count, lab) => count + lab.calculations.length, 0),
  boundary: "Self-report, observation, projection and inference remain distinct in the published questions/calculation context. Whole-pass manual interpretation review and approved Identity/Attention narrative profile bindings remain open." };
await writeFile("docs/hardening/production-takeover-metric-register.json", JSON.stringify(report, null, 2) + "\n");
console.log({ labs: labs.length, calculations: report.calculations, findings: findings.length });
if (findings.length) process.exitCode = 1;
