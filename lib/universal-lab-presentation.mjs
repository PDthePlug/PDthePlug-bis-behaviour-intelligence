const TOOL_HEADING = /^(?:📖|🤔|⏸|🔍|🔎|✍️|⚖️|🤝|📊|🌱|⭐|👁️|🧠)\s*/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function universalHtmlText(html) {
  return decodeEntities(
    String(html ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value) {
  return universalHtmlText(value)
    .replace(TOOL_HEADING, "")
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .replace(/^[✍️☐□■\s]+/u, "")
    .replace(/[:.?!]+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function closeEnough(left, right) {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 18) return false;
  return a.includes(b) || b.includes(a);
}

function isProgressText(text) {
  const compact = text.replace(/\s+/g, "");
  return /[■□]{5,}.*\d\/9/.test(compact);
}

function isStructuralText(text, investigationNumber) {
  const value = text.trim();
  return (
    !value
    || isProgressText(value)
    || /^MISSION\s*:/i.test(value)
    || /^YOU WILL PRODUCE\s*:?$/i.test(value)
    || /^TIME\s*:/i.test(value)
    || /^DIFFICULTY\s*:/i.test(value)
    || /^Page\s+\d+$/i.test(value)
    || /^PHASE\s+[AB]\s*:/i.test(value)
    || /^INVESTIGATION\s+\d+(?:\.\d+)?\s*[—-]/i.test(value)
    || new RegExp(`^INVESTIGATION\\s+${investigationNumber}\\b`, "i").test(value)
    || /^BEHAVIOU?R EVIDENCE INDICATOR \(BEI\) SYSTEM$/i.test(value)
    || /^THINKING EVIDENCE INDICATOR \(TEI\) SYSTEM$/i.test(value)
    || /^ICON CODING\b/i.test(value)
    || /^BEHAVIOU?RAL DIFFICULTY INDICATOR$/i.test(value)
    || /^INVESTIGATION PROGRESS BAR$/i.test(value)
    || /^Each investigation begins with a progress indicator/i.test(value)
    || /^(?:BEI|TEI)-\d{2}\s*:\s*(?:Prediction Calibration Score|Predicted Adherence|Adherence Rate)$/i.test(value)
    || /^Complete this after Investigation\s+\d+/i.test(value)
  );
}

function isToolHeading(text) {
  const value = text.trim();
  if (!TOOL_HEADING.test(value)) return false;
  return value.length < 80;
}

function parseCheckboxOptions(text) {
  if (!text.includes("☐")) return [];
  return text
    .split("☐")
    .map((item) => item.replace(/^[-–—•·\s]+/, "").trim())
    .filter(Boolean)
    .filter((item) => item.length <= 180);
}

function promptScore(prompt, options) {
  const label = String(prompt?.label ?? "").trim();
  const question = String(prompt?.prompt ?? "").trim();
  let score = 0;
  if (options?.length) score += 12;
  if (prompt?.type && prompt.type !== "TEXT") score += 5;
  if (label && question && normalized(label) !== normalized(question)) score += 4;
  if (label.length > 0 && label.length < 80) score += 2;
  if (prompt?.readOnly) score += 2;
  if (prompt?.origin === "BIS_STANDARD") score += 1;
  return score;
}

function preferredPrompt(group, optionsById) {
  return [...group].sort((left, right) => {
    const delta = promptScore(right, optionsById.get(right.id)) - promptScore(left, optionsById.get(left.id));
    if (delta) return delta;
    return String(right.id).localeCompare(String(left.id));
  })[0];
}

function meaningfulStart(blocks, investigationNumber) {
  const exact = blocks.findIndex((block) =>
    block?.type === "HTML"
    && new RegExp(`^INVESTIGATION\\s+${investigationNumber}\\s*[—-]`, "i")
      .test(universalHtmlText(block.html)),
  );
  return exact >= 0 ? exact + 1 : 0;
}

function presentationPromptIds(blocks, prompts) {
  const fromBlocks = new Set(
    blocks
      .filter((block) => block?.type === "PROMPT")
      .map((block) => String(block.promptId ?? "")),
  );
  for (const prompt of prompts) {
    if (prompt?.origin === "BIS_STANDARD" || prompt?.readOnly === true) fromBlocks.add(String(prompt.id ?? ""));
  }
  return fromBlocks;
}

function inferOptions(blocks, promptById) {
  const result = new Map();
  for (let index = 0; index < blocks.length - 1; index += 1) {
    const block = blocks[index];
    const next = blocks[index + 1];
    if (block?.type !== "PROMPT" || next?.type !== "HTML") continue;
    const options = parseCheckboxOptions(universalHtmlText(next.html));
    if (options.length < 2) continue;
    const prompt = promptById.get(String(block.promptId ?? ""));
    if (!prompt) continue;
    result.set(prompt.id, options);
  }
  return result;
}

function normalizeInvestigation(investigation) {
  const authoredPrompts = asArray(investigation?.prompts);
  const promptById = new Map(authoredPrompts.map((prompt) => [String(prompt.id), prompt]));
  const allBlocks = asArray(investigation?.blocks);
  const start = meaningfulStart(allBlocks, Number(investigation?.number));
  const workingBlocks = allBlocks.slice(start);
  const eligibleIds = presentationPromptIds(workingBlocks, authoredPrompts);
  const optionById = inferOptions(workingBlocks, promptById);

  const eligiblePrompts = authoredPrompts.filter((prompt) => eligibleIds.has(String(prompt.id)));
  const groups = new Map();
  for (const prompt of eligiblePrompts) {
    const key = normalized(prompt?.prompt || prompt?.label || prompt?.id);
    const bucket = groups.get(key) ?? [];
    bucket.push(prompt);
    groups.set(key, bucket);
  }

  const alias = new Map();
  const keptById = new Map();
  for (const group of groups.values()) {
    const winner = preferredPrompt(group, optionById);
    const inheritedOptions = group.flatMap((prompt) => optionById.get(prompt.id) ?? []);
    const options = [...new Set(inheritedOptions)];
    const question = String(winner?.prompt ?? "").toLowerCase();
    const multi = /select all|choose all|tick all|which .* apply|any that apply|more than one/i.test(question);
    const prepared = {
      ...winner,
      ...(options.length >= 2 ? {
        type: multi ? "MULTI_SELECT" : "CATEGORICAL",
        options,
      } : {}),
    };
    keptById.set(String(winner.id), prepared);
    for (const prompt of group) alias.set(String(prompt.id), String(winner.id));
  }

  const emittedPrompts = new Set();
  const rendered = [];
  const flushHtml = (parts) => {
    if (!parts.length) return;
    rendered.push({ type: "HTML", html: parts.join("") });
    parts.length = 0;
  };
  const htmlParts = [];

  for (let index = 0; index < workingBlocks.length; index += 1) {
    const block = workingBlocks[index];
    if (block?.type === "PROMPT") {
      flushHtml(htmlParts);
      const mapped = alias.get(String(block.promptId ?? "")) ?? String(block.promptId ?? "");
      if (!keptById.has(mapped) || emittedPrompts.has(mapped)) continue;
      emittedPrompts.add(mapped);
      rendered.push({ type: "PROMPT", promptId: mapped });
      continue;
    }

    if (block?.type !== "HTML") continue;
    const text = universalHtmlText(block.html);
    if (isStructuralText(text, Number(investigation?.number))) continue;

    const previous = workingBlocks[index - 1];
    if (previous?.type === "PROMPT" && parseCheckboxOptions(text).length >= 2) continue;

    const next = workingBlocks[index + 1];
    if (next?.type === "PROMPT") {
      const mapped = alias.get(String(next.promptId ?? "")) ?? String(next.promptId ?? "");
      const prompt = keptById.get(mapped) ?? promptById.get(String(next.promptId ?? ""));
      if (prompt && (closeEnough(text, prompt.prompt) || closeEnough(text, prompt.label))) continue;
      if (isToolHeading(text)) continue;
    }

    // Workbook-only tool headings should become semantic prompt/story styling,
    // not standalone giant cards.
    if (isToolHeading(text)) {
      if (/pause/i.test(text)) htmlParts.push('<div class="bis-source-pause-kicker">Pause</div>');
      continue;
    }

    htmlParts.push(String(block.html ?? ""));
  }
  flushHtml(htmlParts);

  // Standard prompts are intentionally not embedded in the source block stream.
  for (const [id, prompt] of keptById) {
    if (emittedPrompts.has(id)) continue;
    if (prompt.origin !== "BIS_STANDARD" && prompt.readOnly !== true) continue;
    rendered.push({ type: "PROMPT", promptId: id });
    emittedPrompts.add(id);
  }

  const prompts = [...keptById.values()].filter((prompt) => emittedPrompts.has(String(prompt.id)));
  return { ...investigation, prompts, blocks: rendered, __promptAliases: alias };
}

function remapId(id, aliases, validIds) {
  const mapped = aliases.get(String(id ?? "")) ?? String(id ?? "");
  return validIds.has(mapped) ? mapped : null;
}

export function prepareUniversalLabPresentation(source) {
  const next = structuredClone(source);
  const aliases = new Map();
  next.investigations = asArray(next.investigations).map((investigation) => {
    const normalizedInvestigation = normalizeInvestigation(investigation);
    for (const [from, to] of normalizedInvestigation.__promptAliases ?? []) aliases.set(from, to);
    delete normalizedInvestigation.__promptAliases;
    return normalizedInvestigation;
  });

  const validIds = new Set(
    next.investigations.flatMap((investigation) => asArray(investigation.prompts).map((prompt) => String(prompt.id))),
  );

  if (Array.isArray(next.computedFields)) {
    next.computedFields = next.computedFields
      .map((field) => ({
        ...field,
        id: remapId(field.id, aliases, validIds) ?? field.id,
        inputs: asArray(field.inputs)
          .map((id) => remapId(id, aliases, validIds))
          .filter(Boolean),
      }))
      .filter((field) => validIds.has(String(field.id)));
  }

  if (Array.isArray(next.indicatorRegistry)) {
    next.indicatorRegistry = next.indicatorRegistry.map((indicator) => {
      const promptIds = [...new Set(
        asArray(indicator.promptIds)
          .map((id) => remapId(id, aliases, validIds))
          .filter(Boolean),
      )];
      const computedPromptIds = [...new Set(
        asArray(indicator.computedPromptIds)
          .map((id) => remapId(id, aliases, validIds))
          .filter(Boolean),
      )];
      const primaryPromptId = remapId(indicator.primaryPromptId, aliases, validIds);
      return {
        ...indicator,
        promptIds,
        computedPromptIds,
        primaryPromptId,
        status: promptIds.length ? "BOUND" : "UNBOUND",
      };
    });
  }

  if (next.experiment?.scheduledPromptIds) {
    next.experiment.scheduledPromptIds = asArray(next.experiment.scheduledPromptIds)
      .map((entry) => {
        const promptId = remapId(entry?.promptId, aliases, validIds);
        return promptId ? { ...entry, promptId } : null;
      })
      .filter(Boolean);
  }

  if (next.profile?.entries) {
    next.profile.entries = asArray(next.profile.entries)
      .map((entry) => {
        const promptId = remapId(entry?.promptId, aliases, validIds);
        return promptId ? { ...entry, promptId } : null;
      })
      .filter(Boolean);
  }

  return next;
}
