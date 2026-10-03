import { applyDigitalLabBaseline } from "./digital-lab-baseline.mjs";
import { applyHabitLabStandard, auditUniversalLabEditorialQuality } from "./universal-lab-standard.mjs";
import { todayInZone } from "./evidence-validation.mjs";

function normalizeLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/(?:bei|tei)-\d{2}(?:-(?:pre|post))?/g, " ")
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

function buildIndicatorRegistry(investigations, capabilities, computedFields) {
  const fields = investigations.flatMap((investigation) =>
    asArray(investigation.prompts).map((prompt) => ({
      investigation: Number(investigation.number),
      prompt,
    })),
  );
  const computations = new Map(computedFields.map((field) => [field.id, field]));

  return asArray(capabilities?.indicatorCodes).map((rawCode) => {
    const code = String(rawCode).toUpperCase();
    const codePattern = new RegExp(`\\b${code.replace("-", "[- ]?")}\\b`, "i");
    const matches = fields.filter(({ prompt }) =>
      String(prompt.indicatorCode ?? "").toUpperCase() === code
      || codePattern.test(promptText(prompt)),
    );
    const label = matches.map(({ prompt }) => String(prompt.indicatorLabel ?? "").trim()).find(Boolean) || code;
    const promptIds = uniqueById(matches.map(({ prompt }) => ({ id: prompt.id }))).map((item) => item.id);
    const computedPromptIds = promptIds.filter((id) => computations.has(id));

    let primaryPromptId = null;
    if (/\bshift\b/i.test(label)) {
      primaryPromptId = computedPromptIds.find((id) => computations.get(id)?.operation === "DIFFERENCE") ?? null;
    } else if (/\bpost\b/i.test(label)) {
      primaryPromptId = matches.find(({ prompt }) => /\bpost\b/i.test(promptText(prompt)))?.prompt.id ?? null;
    } else if (/\bpre\b/i.test(label)) {
      primaryPromptId = matches.find(({ prompt }) => /\bpre\b/i.test(promptText(prompt)))?.prompt.id ?? null;
    }

    if (!primaryPromptId) {
      const explicitlyCoded = matches.filter(({ prompt }) => codePattern.test(promptText(prompt)) && prompt.readOnly !== true);
      if (explicitlyCoded.length === 1) primaryPromptId = explicitlyCoded[0].prompt.id;
      else if (promptIds.length === 1) primaryPromptId = promptIds[0];
    }

    return {
      code,
      label,
      investigationNumbers: [...new Set(matches.map((entry) => entry.investigation))].sort((a, b) => a - b),
      promptIds,
      computedPromptIds,
      primaryPromptId,
      status: capabilities?.facilitatorOnlyIndicatorCodes?.includes(code) ? "NOT_COLLECTED" : promptIds.length ? "BOUND" : "UNBOUND",
    };
  });
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
  const next = applyHabitLabStandard(applyDigitalLabBaseline(source));
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
      .find((prompt) => /risk actions taken|leadership actions|actions taken|successful actions|times acted/i.test(promptText(prompt)));

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
    .filter((signature) => /\bshift\b/i.test(signature) && /(?:BEI|TEI)-\d{2}\s*-\s*(?:BEI|TEI)-\d{2}/i.test(signature));
  const review = investigations.find((item) => Number(item.number) === 8);
  const shiftOutputs = findShiftOutputs(review);
  shiftFormulas.forEach((signature, index) => {
    const match = signature.match(/((?:BEI|TEI)-\d{2})\s*-\s*((?:BEI|TEI)-\d{2})/i);
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

  // The author should not have to retrofit a digital-only projection contract.
  // If a source clearly contains a Behaviour Profile but its table structure was
  // flattened by Word/PDF/Markdown extraction, manufacture a safe projection
  // from the BEI fields the compiler has already bound.
  if (!profileEntries.length && capabilities.profileSummary && profileInvestigation) {
    const provisional = buildIndicatorRegistry(investigations, capabilities, computedFields)
      .filter((indicator) => indicator.primaryPromptId);
    for (const indicator of provisional) {
      const id = `${String(next.identity?.code || "LAB")}.I9.PROFILE.${String(indicator.code).replace(/[^A-Z0-9]/gi, "")}`;
      const prompt = {
        id,
        label: indicator.label || indicator.code,
        prompt: indicator.label || indicator.code,
        type: "TEXT",
        sensitivity: "P2",
        required: false,
        group: "Behaviour Profile Summary",
      };
      profileInvestigation.prompts = asArray(profileInvestigation.prompts);
      if (!profileInvestigation.prompts.some((candidate) => candidate.id === id)) {
        profileInvestigation.prompts.push(prompt);
      }
      const computation = {
        id,
        label: prompt.label,
        investigation: 9,
        operation: "COPY",
        inputs: [indicator.primaryPromptId],
      };
      markComputed(prompt, computation);
      computedFields.push(computation);
      profileEntries.push({ label: prompt.label, promptId: id, mode: "PROJECTION" });
    }
  }

  const finalComputedFields = uniqueById(computedFields);
  next.schemaVersion = "universal-lab-v2";
  next.runtimeProfile = "UNIVERSAL_V2";
  next.computedFields = finalComputedFields;
  next.indicatorRegistry = buildIndicatorRegistry(investigations, capabilities, finalComputedFields);
  next.experiment = experiment;
  next.profile = profileEntries.length ? { investigation: 9, entries: profileEntries } : null;
  next.editorialAudit = auditUniversalLabEditorialQuality(next);
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

export function universalComputedLeafInputs(definition, computationId) {
  const computations = asArray(definition?.computedFields);
  const byId = new Map(computations.map((item) => [item.id, item]));
  const leaves = new Set();
  const visit = (id, trail = new Set()) => {
    if (trail.has(id)) return;
    const computation = byId.get(id);
    if (!computation) {
      leaves.add(id);
      return;
    }
    const next = new Set(trail);
    next.add(id);
    for (const input of asArray(computation.inputs)) visit(input, next);
  };
  visit(computationId);
  return [...leaves];
}

export function experimentCalendarDay(startedAt, todayIso, totalDays, timeZone = "Africa/Johannesburg") {
  if (!startedAt) return 0;
  const start = String(startedAt).includes("T")
    ? todayInZone(startedAt, timeZone)
    : String(startedAt).slice(0, 10);
  const today = String(todayIso).slice(0, 10);
  const startTime = Date.parse(start + "T00:00:00.000Z");
  const todayTime = Date.parse(today + "T00:00:00.000Z");
  if (!Number.isFinite(startTime) || !Number.isFinite(todayTime)) return 0;
  const day = Math.floor((todayTime - startTime) / 86_400_000) + 1;
  // The extra day represents a closed evidence window, not a writable last day.
  return Math.max(0, Math.min((Number(totalDays) || 7) + 1, day));
}


export function universalExperimentEvidenceProgress(definition, responses, availableExperimentDay = 0) {
  const experiment = definition?.experiment;
  const totalDays = Math.max(0, Number(experiment?.days) || 0);
  const currentDay = Math.max(0, Math.min(totalDays + 1, Number(availableExperimentDay) || 0));
  if (!experiment || totalDays < 1) {
    return {
      experimentStarted: false,
      currentDay: 0,
      totalDays: 0,
      evidenceDaysRecorded: 0,
      todayEvidenceRecorded: false,
    };
  }

  const experimentInvestigation = asArray(definition?.investigations)
    .find((item) => Number(item.number) === Number(experiment.investigation));
  const promptsById = new Map(
    asArray(experimentInvestigation?.prompts).map((prompt) => [String(prompt.id), prompt]),
  );
  const schedule = new Map();
  let currentWindow = currentDay;

  for (const entry of asArray(experiment.scheduledPromptIds)) {
    const day = Number(entry?.day);
    const promptId = String(entry?.promptId ?? "");
    const prompt = promptsById.get(promptId);
    if (!Number.isInteger(day) || day < 1 || day > totalDays || !prompt || prompt.readOnly === true) continue;
    const bucket = schedule.get(day) ?? { required: new Set(), writable: new Set() };
    bucket.writable.add(promptId);
    if (prompt.required !== false) bucket.required.add(promptId);
    schedule.set(day, bucket);
    if (entry.endDay && currentDay >= day && currentDay <= Number(entry.endDay)) currentWindow = day;
  }

  const answered = (promptId) => {
    const response = responses?.[promptId];
    return Boolean(response && ["ANSWERED", "PASS"].includes(String(response.status ?? "")));
  };
  const dayComplete = (day) => {
    const bucket = schedule.get(day);
    if (!bucket || !bucket.writable.size) return false;
    if (bucket.required.size) return [...bucket.required].every(answered);
    return [...bucket.writable].some(answered);
  };

  const evidenceDaysRecorded = [...schedule.keys()].filter(dayComplete).length;

  return {
    experimentStarted: currentDay > 0,
    currentDay,
    totalDays,
    evidenceDaysRecorded,
    todayEvidenceRecorded: currentDay > 0 && currentDay <= totalDays && dayComplete(currentWindow),
    ...(experiment.cadence === "WEEKLY" ? { evidenceWindowCount: schedule.size } : {}),
  };
}

export function universalExperimentReviewReady(definition, responses, availableExperimentDay = 0) {
  const experiment = definition?.experiment;
  const totalDays = Math.max(0, Number(experiment?.days) || 0);
  const currentDay = Math.max(0, Number(availableExperimentDay) || 0);
  if (!experiment || totalDays < 1 || currentDay < totalDays) return false;
  if (currentDay > totalDays) return true;

  const progress = universalExperimentEvidenceProgress(definition, responses, currentDay);
  return progress.todayEvidenceRecorded;
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
