function normalizeQuestion(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(?:bei|tei)-\d{2}(?:-(?:pre|post))?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|your|you|my|i|this|that|what|which|please|answer)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableToken(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function evidenceClass(investigation) {
  if (investigation === 0) return "BASELINE";
  if (investigation >= 1 && investigation <= 6) return "PHASE_A";
  if (investigation === 7) return "OBSERVATION";
  if (investigation === 8) return "INTERPRETATION";
  if (investigation === 9) return "TRANSFER";
  return "PHASE_A";
}

function prompts(definition) {
  const entries = [];
  for (const prompt of definition?.presentationBaseline?.items ?? []) entries.push({ investigation: 0, prompt });
  if (definition?.presentationBaseline?.metric) entries.push({ investigation: 0, prompt: definition.presentationBaseline.metric });
  for (const investigation of definition?.investigations ?? []) {
    for (const prompt of investigation?.prompts ?? []) {
      entries.push({ investigation: Number(investigation.number ?? 0), prompt });
    }
  }
  return entries;
}

export function questionIntelligenceRegistry(definition, { labCode, labVersion, versionId }) {
  return prompts(definition)
    .filter(({ prompt }) => prompt?.id && prompt.readOnly !== true && !prompt.computed)
    .map(({ investigation, prompt }) => {
      const answerModel = String(prompt.type ?? "TEXT").toUpperCase();
      const sensitivity = String(prompt.sensitivity ?? "P2").toUpperCase();
      const normalized = normalizeQuestion(prompt.prompt || prompt.label || prompt.id);
      const aggregatePolicy =
        sensitivity === "P3" || answerModel === "TEXT" || answerModel === "DATE"
          ? "EXCLUDE"
          : ["INTEGER", "BOOLEAN", "CATEGORICAL", "MULTI_SELECT"].includes(answerModel)
            ? "STRUCTURED_ONLY"
            : "EXCLUDE";
      return {
        id: `${versionId}:${prompt.id}`,
        versionId,
        labCode,
        labVersion,
        semanticFieldId: String(prompt.id),
        questionFamily: `QF-${stableToken(normalized || String(prompt.id))}`,
        label: String(prompt.label || prompt.prompt || prompt.id).trim().slice(0, 500),
        evidenceClass: evidenceClass(investigation),
        answerModel,
        sensitivity,
        aggregatePolicy,
        status: "ACTIVE",
      };
    });
}
