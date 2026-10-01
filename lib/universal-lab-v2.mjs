function normalizeLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/bei-\d{2}(?:-(?:pre|post))?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(my|the|your|answer|current|what|it|me|would)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function promptText(prompt) {
  return [prompt?.id, prompt?.label, prompt?.prompt, prompt?.group].filter(Boolean).join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function fieldByPattern(investigations, pattern, beforeInvestigation = 10) {
  for (const investigation of investigations) {
    if (Number(investigation.number) >= beforeInvestigation) continue;
    for (const prompt of asArray(investigation.prompts)) {
      if (pattern.test(promptText(prompt))) return prompt;
    }
  }
  return null;
}

function markComputed(prompt, metadata) {
  if (!prompt) return;
  prompt.required = false;
  prompt.readOnly = true;
  prompt.computed = metadata;
}

function uniqueById(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value?.id || seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

function findShiftOutputs(investigation) {
  return asArray(investigation?.prompts).filter((prompt) => /^shift\b/i.test(String(prompt.label ?? "")));
}

function beiField(investigations, code, phaseHint) {
  const strict = new RegExp(`\\b${code.replace("-", "[- ]?")}\\b`, "i");
  const candidates = investigations.flatMap((investigation) =>
    asArray(investigation.prompts).map((prompt) => ({ investigation: Number(investigation.number), prompt })),
  ).filter(({ prompt }) => strict.test(promptText(prompt)));

  if (!candidates.length) return null;
  if (phaseHint === "pre") {
    return candidates.find(({ prompt, investigation }) => /\bpre\b/i.test(promptText(prompt)) || investigation <= 5)?.prompt ?? candidates[0].prompt;
  }
  if (phaseHint === "post") {
    return candidates.find(({ prompt, investigation }) => /\bpost\b/i.test(promptText(prompt)) || investigation >= 8)?.prompt ?? candidates.at(-1).prompt;
  }
  return candidates[0].prompt;
}

function profilePairSources(investigations, target) {
  const normalized = normalizeLabel(target.label);
  if (!/\bpre\b/.test(normalized) || !/\bpost\b/.test(normalized)) return null;
  const subject = normalized
    .replace(/\bpre\b|\bpost\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!subject) return null;

  const candidates = investigations
    .filter((investigation) => Number(investigation.number) < 9)
    .flatMap((investigation) =>
      asArray(investigation.prompts).map((prompt) => ({
        investigation: Number(investigation.number),
        prompt,
        normalized: normalizeLabel(prompt.label),
      })),
    )
    .filter((entry) => subject.split(" ").every((word) => entry.normalized.includes(word)));

  const pre = candidates.find((entry) => /\bpre\b/.test(entry.normalized))
    ?? candidates.find((entry) => entry.investigation <= 5);
  const post = candidates.find((entry) => /\bpost\b/.test(entry.normalized))
    ?? [...candidates].reverse().find((entry) => entry.investigation >= 8);
  return pre && post && pre.prompt.id !== post.prompt.id ? [pre.prompt, post.prompt] : null;
}

function mappedProfileSource(investigations, target) {
  const targetLabel = normalizeLabel(target.label);
  if (!targetLabel) return null;
  const candidates = investigations
    .filter((investigation) => Number(investigation.number) < 9)
    .flatMap((investigation) => asArray(investigation.prompts));

  const exact = candidates.find((prompt) => normalizeLabel(prompt.label) === targetLabel);
  if (exact) return exact;

  const targetWords = new Set(targetLabel.split(" ").filter((word) => word.length > 2));
  let best = null;
  let bestScore = 0;
  for (const prompt of candidates) {
    const sourceWords = new Set(normalizeLabel(prompt.label).split(" ").filter((word) => word.length > 2));
    if (!sourceWords.size || !targetWords.size) continue;
    const common = [...targetWords].filter((word) => sourceWords.has(word)).length;
    const score = common / Math.max(targetWords.size, sourceWords.size);
    if (score > bestScore) {
      best = prompt;
      bestScore = score;
    }
  }
  return bestScore >= 0.75 ? best : null;
}

/**
 * Upgrade an adapted Universal V1-shaped document package into the declarative
 * Universal V2 behaviour contract. This function contains no Lab-code switch:
 * it derives reusable semantics from the authored structures that the adapter
 * already extracted.
 */
export function upgradeUniversalLabV2(source) {
  const next = structuredClone(source);
  const investigations = asArray(next.investigations);
  const capabilities = next.factoryCapabilities ?? {};
  const computedFields = [];

  // Repeated score tables: derive the score rather than asking a learner to type it.
  for (const investigation of investigations) {
    const groups = new Map();
    for (const prompt of asArray(investigation.prompts)) {
      if (!prompt.group) continue;
      const bucket = groups.get(prompt.group) ?? [];
      bucket.push(prompt);
      groups.set(prompt.group, bucket);
    }
    for (const [group, prompts] of groups) {
      const probability = prompts.find((prompt) => /\bprobability\b/i.test(promptText(prompt)));
      const magnitude = prompts.find((prompt) => /\bmagnitude\b/i.test(promptText(prompt)));
      const score = prompts.find((prompt) => /\bscore\b/i.test(promptText(prompt)));
      if (!probability || !magnitude || !score) continue;
      const computation = {
        id: score.id,
        label: score.label || group + " score",
        investigation: Number(investigation.number),
        operation: "PRODUCT",
        inputs: [probability.id, magnitude.id],
        precision: 0,
      };
      markComputed(score, computation);
      computedFields.push(computation);
    }
  }

  // Real-world experiment: retain authored day rows, but make calendar day a
  // runtime constraint rather than a learner-entered convention.
  let experiment = null;
  if (capabilities.experiment?.detected) {
    const experimentInvestigation = investigations.find((item) => Number(item.number) === 7);
    const scheduled = [];
    for (const prompt of asArray(experimentInvestigation?.prompts)) {
      const match = String(prompt.group ?? "").match(/^Day\s+(\d+)$/i);
      if (!match) continue;
      const day = Number(match[1]);
      prompt.scheduleDay = day;
      scheduled.push({ day, promptId: prompt.id });
    }
    const inferredDays = Math.max(0, ...scheduled.map((item) => item.day));
    const days = Number(capabilities.experiment.days) || inferredDays || 7;
    experiment = {
      investigation: 7,
      startAfterInvestigation: 6,
      days,
      reviewInvestigation: 8,
      scheduledPromptIds: scheduled,
    };

    const actionChecks = asArray(experimentInvestigation?.prompts)
      .filter((prompt) => /action check|did i take action/i.test(promptText(prompt)));
    const daysCompleted = asArray(experimentInvestigation?.prompts)
      .find((prompt) => /days completed/i.test(promptText(prompt)));
    const actionsTaken = asArray(experimentInvestigation?.prompts)
      .find((prompt) => /risk actions taken|actions taken/i.test(promptText(prompt)));

    if (daysCompleted && actionChecks.length) {
      const computation = {
        id: daysCompleted.id,
        label: daysCompleted.label,
        investigation: 7,
        operation: "COUNT_PRESENT",
        inputs: actionChecks.map((prompt) => prompt.id),
        precision: 0,
      };
      markComputed(daysCompleted, computation);
      computedFields.push(computation);
    }
    if (actionsTaken && actionChecks.length) {
      const computation = {
        id: actionsTaken.id,
        label: actionsTaken.label,
        investigation: 7,
        operation: "COUNT_TRUE",
        inputs: actionChecks.map((prompt) => prompt.id),
        precision: 0,
      };
      markComputed(actionsTaken, computation);
      computedFields.push(computation);
    }
  }

  // Authored pre/post shift formulas are declarative. The detector preserves
  // the source formula text; the runtime resolves the referenced BEI fields.
  const shiftFormulas = asArray(capabilities.derivedSignatures)
    .map((signature) => String(signature))
    .filter((signature) => /\bshift\b/i.test(signature) && /BEI-\d{2}\s*-\s*BEI-\d{2}/i.test(signature));
  const review = investigations.find((item) => Number(item.number) === 8);
  const shiftOutputs = findShiftOutputs(review);
  shiftFormulas.forEach((signature, index) => {
    const match = signature.match(/(BEI-\d{2})\s*-\s*(BEI-\d{2})/i);
    const output = shiftOutputs[index];
    if (!match || !output) return;
    const post = beiField(investigations, match[1].toUpperCase(), "post");
    const pre = beiField(investigations, match[2].toUpperCase(), "pre");
    if (!post || !pre) return;
    const computation = {
      id: output.id,
      label: output.label,
      investigation: 8,
      operation: "DIFFERENCE",
      inputs: [post.id, pre.id],
      precision: 0,
    };
    markComputed(output, computation);
    computedFields.push(computation);
  });

  // Profile tables can reuse earlier evidence instead of forcing the learner
  // to retype it. Unmatched profile entries remain genuine learner inputs.
  const profileInvestigation = investigations.find((item) => Number(item.number) === 9);
  const profilePrompts = asArray(profileInvestigation?.prompts)
    .filter((prompt) => /behaviou?r profile summary/i.test(String(prompt.group ?? "")));
  const profileEntries = [];
  for (const target of profilePrompts) {
    const pairSources = profilePairSources(investigations, target);
    let sourcePrompt = pairSources ? null : mappedProfileSource(investigations, target);
    let computation = pairSources ? {
      id: target.id,
      label: target.label,
      investigation: 9,
      operation: "PAIR",
      inputs: pairSources.map((prompt) => prompt.id),
    } : null;

    if (!sourcePrompt && /\bscore\b/i.test(String(target.label ?? ""))) {
      const scoreFields = computedFields.filter((item) => item.operation === "PRODUCT");
      if (scoreFields.length) {
        computation = {
          id: target.id,
          label: target.label,
          investigation: 9,
          operation: "MAX",
          inputs: scoreFields.map((item) => item.id),
          precision: 0,
        };
      }
    }

    if (sourcePrompt) {
      computation = {
        id: target.id,
        label: target.label,
        investigation: 9,
        operation: "COPY",
        inputs: [sourcePrompt.id],
      };
    }

    if (computation) {
      markComputed(target, computation);
      computedFields.push(computation);
      profileEntries.push({ label: target.label, promptId: target.id, mode: "PROJECTION" });
    } else {
      profileEntries.push({ label: target.label, promptId: target.id, mode: "INPUT" });
    }
  }

  next.schemaVersion = "universal-lab-v2";
  next.runtimeProfile = "UNIVERSAL_V2";
  next.computedFields = uniqueById(computedFields);
  next.experiment = experiment;
  next.profile = profileEntries.length ? { investigation: 9, entries: profileEntries } : null;
  return next;
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function truthy(value) {
  if (value === true || value === 1) return true;
  return ["yes", "true", "1", "checked"].includes(String(value ?? "").trim().toLowerCase());
}

function present(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function evaluateUniversalComputed(definition, responseValues) {
  const results = {};
  const computations = asArray(definition?.computedFields);
  const resolve = (id, trail = new Set()) => {
    if (Object.prototype.hasOwnProperty.call(results, id)) return results[id];
    if (Object.prototype.hasOwnProperty.call(responseValues, id)) return responseValues[id];
    const computation = computations.find((item) => item.id === id);
    if (!computation || trail.has(id)) return null;
    const nextTrail = new Set(trail);
    nextTrail.add(id);
    const values = asArray(computation.inputs).map((input) => resolve(input, nextTrail));

    let value = null;
    if (computation.operation === "PRODUCT") {
      const numbers = values.map(numberValue);
      value = numbers.every((item) => item !== null)
        ? numbers.reduce((total, item) => total * item, 1)
        : null;
    } else if (computation.operation === "DIFFERENCE") {
      const left = numberValue(values[0]);
      const right = numberValue(values[1]);
      value = left !== null && right !== null ? left - right : null;
    } else if (computation.operation === "COUNT_TRUE") {
      value = values.filter(truthy).length;
    } else if (computation.operation === "COUNT_PRESENT") {
      value = values.filter(present).length;
    } else if (computation.operation === "MAX") {
      const numbers = values.map(numberValue).filter((item) => item !== null);
      value = numbers.length ? Math.max(...numbers) : null;
    } else if (computation.operation === "COPY") {
      value = values[0] ?? null;
    } else if (computation.operation === "PAIR") {
      value = present(values[0]) || present(values[1])
        ? `${present(values[0]) ? values[0] : "—"} → ${present(values[1]) ? values[1] : "—"}`
        : null;
    }

    if (typeof value === "number" && Number.isFinite(computation.precision)) {
      const factor = 10 ** Number(computation.precision);
      value = Math.round(value * factor) / factor;
    }
    results[id] = value;
    return value;
  };

  for (const computation of computations) resolve(computation.id);
  return results;
}

export function experimentCalendarDay(startedAt, todayIso, totalDays) {
  if (!startedAt) return 0;
  const start = String(startedAt).slice(0, 10);
  const today = String(todayIso).slice(0, 10);
  const startTime = Date.parse(start + "T00:00:00.000Z");
  const todayTime = Date.parse(today + "T00:00:00.000Z");
  if (!Number.isFinite(startTime) || !Number.isFinite(todayTime)) return 0;
  const day = Math.floor((todayTime - startTime) / 86_400_000) + 1;
  return Math.max(0, Math.min(Number(totalDays) || 7, day));
}

export function v2RequiredPromptIds(definition, investigationNumber, availableExperimentDay = 0) {
  const investigation = asArray(definition?.investigations)
    .find((item) => Number(item.number) === Number(investigationNumber));
  if (!investigation) return [];
  return asArray(investigation.prompts)
    .filter((prompt) => prompt.required !== false && prompt.readOnly !== true)
    .filter((prompt) => !prompt.scheduleDay || Number(prompt.scheduleDay) <= availableExperimentDay)
    .map((prompt) => prompt.id);
}
