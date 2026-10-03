function normalizeQuestion(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(?:bei|tei)-\d{2}(?:-(?:pre|post))?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|your|you|my|i|this|that|what|which|please|answer)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenPrompts(definition) {
  const rows = [];
  for (const prompt of definition?.presentationBaseline?.items ?? []) {
    rows.push({ investigation: 0, prompt });
  }
  if (definition?.presentationBaseline?.metric) {
    rows.push({ investigation: 0, prompt: definition.presentationBaseline.metric });
  }
  for (const investigation of definition?.investigations ?? []) {
    for (const prompt of investigation?.prompts ?? []) {
      rows.push({ investigation: Number(investigation.number ?? 0), prompt });
    }
  }
  return rows;
}

function learnerInput(entry) {
  return entry.prompt?.readOnly !== true && !entry.prompt?.computed;
}

export function auditLabQuestionQuality(definition) {
  const rows = flattenPrompts(definition);
  const inputs = rows.filter(learnerInput);
  const derived = rows.filter((entry) => !learnerInput(entry));

  const groups = new Map();
  for (const entry of inputs) {
    const text = normalizeQuestion(entry.prompt?.prompt || entry.prompt?.label);
    if (text.length < 12) continue;
    const values = groups.get(text) ?? [];
    values.push(entry);
    groups.set(text, values);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([fingerprint, entries]) => ({
      fingerprint,
      promptIds: entries.map((entry) => String(entry.prompt.id)),
      investigations: [...new Set(entries.map((entry) => entry.investigation))].sort((a, b) => a - b),
      count: entries.length,
    }));

  const density = [];
  for (const investigation of definition?.investigations ?? []) {
    const count = (investigation?.prompts ?? []).filter((prompt) =>
      prompt?.readOnly !== true && !prompt?.computed
    ).length;
    if (count >= 9) {
      density.push({
        investigation: Number(investigation.number),
        learnerInputs: count,
      });
    }
  }

  const reusedPromptIds = new Set();
  for (const field of definition?.computedFields ?? []) {
    for (const input of field?.inputs ?? []) reusedPromptIds.add(String(input));
  }
  for (const indicator of definition?.indicatorRegistry ?? []) {
    for (const promptId of indicator?.promptIds ?? []) reusedPromptIds.add(String(promptId));
  }
  for (const entry of definition?.profile?.entries ?? []) {
    if (entry?.promptId) reusedPromptIds.add(String(entry.promptId));
  }

  const reviewItems = [];
  for (const group of duplicateGroups) {
    reviewItems.push(
      `${group.count} learner questions repeat the same wording across ${group.investigations.map((value) => value === 0 ? "baseline" : `Investigation ${value}`).join(", ")}. Confirm that repetition is measuring change rather than asking twice.`,
    );
  }
  for (const item of density) {
    reviewItems.push(
      `Investigation ${item.investigation} contains ${item.learnerInputs} learner inputs. Review whether each question has a distinct evidence job.`,
    );
  }

  return {
    totalPrompts: rows.length,
    learnerInputs: inputs.length,
    derivedFields: derived.length,
    reusedInputs: inputs.filter((entry) => reusedPromptIds.has(String(entry.prompt.id))).length,
    duplicateGroups,
    denseInvestigations: density,
    reviewItems,
    principle: "Ask once when possible. Reuse the answer. Derive what can safely be derived.",
  };
}
