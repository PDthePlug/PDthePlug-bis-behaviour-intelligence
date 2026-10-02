import { normalizePromptResponseValue, validPromptResponse } from "./evidence-validation.mjs";

/** One prompt window for rendering, submission and required-field validation. */
export function availableLabPrompts(definition, investigationNumber, day = 0, preview = false) {
  const baseline = definition?.presentationBaseline;
  const prompts = Number(investigationNumber) === 0
    ? [...(baseline?.items ?? []), ...(baseline?.metric ? [baseline.metric] : [])]
    : (definition?.investigations ?? []).find((item) => Number(item.number) === Number(investigationNumber))?.prompts ?? [];
  const experiment = definition?.runtimeProfile === "UNIVERSAL_V2"
    && Number(investigationNumber) === Number(definition?.experiment?.investigation);
  return prompts.filter((prompt) => {
    if (preview) return true;
    if (experiment) {
      if (!prompt.scheduleDay) return prompt.readOnly === true;
      return prompt.scheduleEndDay
        ? Number(day) >= Number(prompt.scheduleDay) && Number(day) <= Number(prompt.scheduleEndDay)
        : Number(prompt.scheduleDay) === Number(day);
    }
    return !prompt.scheduleDay || Number(prompt.scheduleDay) <= Number(day);
  });
}

export function requiredLabPromptIds(definition, investigationNumber, day = 0) {
  return availableLabPrompts(definition, investigationNumber, day)
    .filter((prompt) => prompt.required !== false && prompt.readOnly !== true)
    .map((prompt) => prompt.id);
}

/** Validate exactly the controls available to the learner, retaining valid saves. */
export function validateLabSubmission(definition, investigationNumber, day, items, existing = {}) {
  const prompts = availableLabPrompts(definition, investigationNumber, day)
    .filter((prompt) => prompt.readOnly !== true);
  const allowed = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const seen = new Set();
  const validated = items.map((raw) => {
    const item = raw && typeof raw === "object" ? raw : {};
    const id = String(item.semanticFieldId ?? "");
    const prompt = allowed.get(id);
    if (!prompt || seen.has(id)) throw new Error("This response is outside the current activity. Reload the Lab and try again.");
    seen.add(id);
    const responseStatus = item.responseStatus === "PASS" ? "PASS" : "ANSWERED";
    const value = responseStatus === "PASS" ? "" : normalizePromptResponseValue(prompt, item.value);
    if (!validPromptResponse(prompt, value, responseStatus)) {
      throw new Error(`Check your response: ${prompt.label}`);
    }
    return { semanticFieldId: id, prompt, responseStatus, value };
  });
  const missing = prompts.filter((prompt) => {
    if (prompt.required === false || seen.has(prompt.id)) return false;
    const saved = existing[prompt.id];
    return !saved || !validPromptResponse(prompt, normalizePromptResponseValue(prompt, saved.value), saved.status);
  });
  if (missing.length) throw new Error(`Complete or pass: ${missing.slice(0, 4).map((prompt) => prompt.label).join(" · ")}`);
  return validated;
}
