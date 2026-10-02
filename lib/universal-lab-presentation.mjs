const TOOL_HEADING = /^(?:📖|🤔|⏸|🔍|🔎|✍️|⚖️|🤝|📊|🌱|⭐|👁️|🧠)\s*/u;
const INDICATOR_CODE = /\b(?:BEI|TEI)-\d{2}(?:-(?:PRE|POST))?\b/i;
const INDICATOR_PREFIX = /^\s*(?:BEI|TEI)-\d{2}(?:-(?:PRE|POST))?\s*[:\-–—]?\s*/i;
const BLANK_CELL = /^(?:[_—–-]{2,}|\.{3,})$/u;

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

function collapseRepeatedWords(value) {
  return String(value ?? "")
    .replace(/\b([a-z][a-z'-]{2,})\s+\1\b/gi, "$1")
    .replace(/\bprediction\s+prediction-to-outcome\b/gi, "prediction-to-outcome")
    .replace(/\bcheck\s+check\b/gi, "check")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLearnerText(value, { stripIndicator = false } = {}) {
  let text = universalHtmlText(value)
    .replace(/^\s*[☐□■]\s*/u, "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripIndicator) text = text.replace(INDICATOR_PREFIX, "");
  return collapseRepeatedWords(text)
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function normalized(value) {
  return cleanLearnerText(value, { stripIndicator: true })
    .replace(TOOL_HEADING, "")
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
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

function stableToken(value) {
  let hash = 2166136261;
  const input = String(value ?? "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function isProgressText(text) {
  const compact = text.replace(/\s+/g, "");
  return /[■□]{5,}.*\d\/9/.test(compact);
}

function isTechnicalIndicatorText(text) {
  const value = cleanLearnerText(text);
  if (!INDICATOR_PREFIX.test(value)) return false;
  return !value.includes("?") || /\b(?:score|index|rate|indicator|measure|pre|post)\b/i.test(value);
}

function isStructuralText(text, investigationNumber) {
  const value = cleanLearnerText(text);
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
    || isTechnicalIndicatorText(value)
    || /^Complete this after Investigation\s+\d+/i.test(value)
  );
}

function isToolHeading(text) {
  const value = String(text ?? "").trim();
  if (!TOOL_HEADING.test(value)) return false;
  return universalHtmlText(value).length < 80;
}

function cleanOption(value) {
  const option = cleanLearnerText(value, { stripIndicator: false })
    .replace(/^[-–—•·\s]+/, "")
    .trim();
  if (!option || INDICATOR_PREFIX.test(option)) return "";
  return option;
}

function parseCheckboxOptions(text) {
  if (!String(text ?? "").includes("☐")) return [];
  return String(text)
    .split("☐")
    .map(cleanOption)
    .filter(Boolean)
    .filter((item) => item.length <= 180);
}

function cleanProduces(values) {
  const result = [];
  const seen = new Set();
  for (const raw of asArray(values)) {
    let value = cleanLearnerText(raw, { stripIndicator: true });
    if (!value) continue;
    if (/prediction.*(?:outcome|correct).*check/i.test(value)) value = "A check of your original prediction";
    if (/^(?:score|index|rate|indicator|measure)\b/i.test(value)) continue;
    const key = normalized(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function presentationBaseline(source) {
  const investigation = asArray(source?.investigations).find((item) => Number(item?.number) === 1);
  if (!investigation) return null;
  const blocks = asArray(investigation.blocks);
  const start = meaningfulStart(blocks, 1);
  if (start <= 0) return null;

  const prefix = blocks.slice(0, start);
  const promptIds = new Set(
    prefix
      .filter((block) => block?.type === "PROMPT")
      .map((block) => String(block.promptId ?? "")),
  );
  const prompts = asArray(investigation.prompts)
    .filter((prompt) => promptIds.has(String(prompt.id)))
    .map((prompt) => sanitizePrompt(prompt));

  const items = prompts.filter((prompt) =>
    String(prompt.group ?? "").trim().toLowerCase() === "baseline"
    && prompt.readOnly !== true,
  );
  const metric = prompts.find((prompt) =>
    prompt.readOnly !== true
    && (
      /baseline\s*[—-]\s*pre/i.test(String(prompt.group ?? ""))
      || /\bpre\b/i.test(String(prompt.label ?? ""))
    ),
  ) ?? null;
  if (!items.length && !metric) return null;

  const prefixText = prefix
    .filter((block) => block?.type === "HTML")
    .map((block) => universalHtmlText(block.html))
    .filter(Boolean);
  const title = cleanLearnerText(
    prefixText.find((value) => /baseline\s*[—-]\s*pre/i.test(value)) ?? "Behaviour baseline — before",
    { stripIndicator: true },
  );
  const introduction = cleanLearnerText(
    prefixText.find((value) => /^Before you begin/i.test(value) || /starting point/i.test(value))
      ?? "Complete this starting check-in before Investigation 1. This is evidence, not judgment.",
  );

  return { title, introduction, items, metric };
}

function sanitizePrompt(prompt) {
  const rawLabel = String(prompt?.label ?? "");
  const rawPrompt = String(prompt?.prompt ?? "");
  const technical = INDICATOR_PREFIX.test(cleanLearnerText(rawLabel))
    || INDICATOR_PREFIX.test(cleanLearnerText(rawPrompt));
  const options = asArray(prompt?.options).map(cleanOption).filter(Boolean);
  let label = cleanLearnerText(rawLabel, { stripIndicator: true }) || "Your response";
  let question = cleanLearnerText(rawPrompt, { stripIndicator: true }) || label;

  if (technical && options.length === 2
      && options.map((item) => item.toLowerCase()).sort().join("|") === "correct|incorrect") {
    label = "Prediction check";
    question = "Was your prediction correct?";
  }

  return {
    ...prompt,
    label,
    prompt: question,
    ...(options.length ? { options } : prompt?.options ? { options: [] } : {}),
    __technicalPresentation: technical,
  };
}

function promptScore(prompt, options) {
  const label = String(prompt?.label ?? "").trim();
  const question = String(prompt?.prompt ?? "").trim();
  let score = 0;
  if (options?.length) score += 12;
  if (prompt?.type && prompt.type !== "TEXT") score += 5;
  if (label && question && normalized(label) !== normalized(question)) score += 4;
  if (label.length > 0 && label.length < 80) score += 2;
  if (!prompt?.__technicalPresentation) score += 8;
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

function tablePromptIds(block) {
  if (block?.type !== "TABLE") return [];
  return asArray(block.rows)
    .flatMap((row) => asArray(row))
    .filter((cell) => cell?.kind === "PROMPT")
    .map((cell) => String(cell.promptId ?? ""))
    .filter(Boolean);
}

function presentationPromptIds(blocks, prompts) {
  const fromBlocks = new Set();
  for (const block of blocks) {
    if (block?.type === "PROMPT") fromBlocks.add(String(block.promptId ?? ""));
    for (const id of tablePromptIds(block)) fromBlocks.add(id);
  }
  for (const prompt of prompts) {
    if (prompt?.origin === "BIS_STANDARD" || prompt?.readOnly === true) fromBlocks.add(String(prompt.id ?? ""));
  }
  return fromBlocks;
}

function inferOptions(blocks, promptById) {
  const result = new Map();
  for (const prompt of promptById.values()) {
    const existing = asArray(prompt.options).map(cleanOption).filter(Boolean);
    if (existing.length) result.set(prompt.id, existing);
  }
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

function cleanCell(value) {
  return cleanLearnerText(value)
    .replace(/^\|+|\|+$/g, "")
    .trim();
}

function parseTableRows(tableHtml) {
  const rows = [];
  for (const rowMatch of String(tableHtml).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)) {
      cells.push(cleanCell(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function blankLike(value) {
  const text = cleanCell(value).replace(/\s+/g, "");
  return !text || BLANK_CELL.test(text);
}

function tableCellPrompt(code, investigationNumber, headers, row, rowIndex, columnIndex) {
  const header = headers[columnIndex] || `Response ${columnIndex + 1}`;
  const rowLabel = row.find((value, index) => index !== columnIndex && !blankLike(value)) || `Entry ${rowIndex}`;
  const seed = [headers.join("|"), rowLabel, header, rowIndex, columnIndex].join("|");
  const id = `${code}.I${investigationNumber}.TABLE.${stableToken(seed)}`;
  const date = /\bdate\b/i.test(header);
  return {
    id,
    label: header,
    prompt: rowLabel && normalized(rowLabel) !== normalized(header)
      ? `${header} — ${rowLabel}`
      : header,
    type: date ? "DATE" : "TEXT",
    placeholder: date ? undefined : "Type your response…",
    sensitivity: "P2",
    required: true,
    group: rowLabel,
    origin: "SOURCE",
  };
}

function semanticTableBlock(tableHtml, code, investigationNumber, tableIndex) {
  const rows = parseTableRows(tableHtml);
  if (rows.length < 2 || rows[0].length < 2) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const headers = Array.from({ length: width }, (_, index) => cleanCell(rows[0][index] ?? "") || `Column ${index + 1}`);
  const body = rows.slice(1).map((row) => Array.from({ length: width }, (_, index) => cleanCell(row[index] ?? "")));
  const blankCount = body.reduce((total, row) => total + row.filter(blankLike).length, 0);
  if (!blankCount) return null;

  const prompts = [];
  const renderedRows = body.map((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      if (!blankLike(cell)) return { kind: "TEXT", text: cell };
      const prompt = tableCellPrompt(code, investigationNumber, headers, row, rowIndex + 1, columnIndex);
      prompts.push(prompt);
      return { kind: "PROMPT", promptId: prompt.id };
    }),
  );

  if (!prompts.length) return null;
  return {
    block: {
      type: "TABLE",
      id: `${code}.I${investigationNumber}.TABLE.${tableIndex}.${stableToken(headers.join("|"))}`,
      headers,
      rows: renderedRows,
    },
    prompts,
  };
}

function expandSemanticTables(blocks, prompts, code, investigationNumber) {
  const nextBlocks = [];
  const nextPrompts = [...prompts];
  const existing = new Set(nextPrompts.map((prompt) => String(prompt.id)));
  let tableIndex = 0;

  for (const block of blocks) {
    if (block?.type === "TABLE") {
      nextBlocks.push(block);
      continue;
    }
    if (block?.type !== "HTML" || !/<table\b/i.test(String(block.html ?? ""))) {
      nextBlocks.push(block);
      continue;
    }

    const parts = String(block.html ?? "").split(/(<table\b[\s\S]*?<\/table>)/gi).filter(Boolean);
    for (const part of parts) {
      if (!/^<table\b/i.test(part.trim())) {
        if (universalHtmlText(part)) nextBlocks.push({ type: "HTML", html: part });
        continue;
      }
      tableIndex += 1;
      const semantic = semanticTableBlock(part, code, investigationNumber, tableIndex);
      if (!semantic) {
        nextBlocks.push({ type: "HTML", html: part });
        continue;
      }
      for (const prompt of semantic.prompts) {
        if (existing.has(prompt.id)) continue;
        existing.add(prompt.id);
        nextPrompts.push(prompt);
      }
      nextBlocks.push(semantic.block);
    }
  }

  return { blocks: nextBlocks, prompts: nextPrompts };
}

function choiceSignature(prompt, optionById) {
  const options = (optionById.get(prompt.id) ?? asArray(prompt.options))
    .map(cleanOption)
    .filter(Boolean)
    .map((item) => normalized(item))
    .filter(Boolean)
    .sort();
  if (!options.length && prompt.type === "BOOLEAN") return "no|yes";
  return options.length >= 2 ? options.join("|") : "";
}

function reconcileIndicatorDuplicates(keptById, alias, optionById) {
  const entries = [...keptById.entries()];
  for (const [technicalId, technical] of entries) {
    if (!technical?.__technicalPresentation || !keptById.has(technicalId)) continue;
    const signature = choiceSignature(technical, optionById);
    if (!signature) continue;
    const humanEntry = [...keptById.entries()].find(([id, candidate]) =>
      id !== technicalId
      && !candidate?.__technicalPresentation
      && choiceSignature(candidate, optionById) === signature,
    );
    if (!humanEntry) continue;

    const [humanId, human] = humanEntry;
    const rawCode = String(technical.indicatorCode ?? "")
      || (String(technical.label ?? technical.prompt ?? "").match(INDICATOR_CODE)?.[0]?.toUpperCase() ?? "");
    keptById.set(humanId, {
      ...human,
      ...(human.indicatorCode ? {} : rawCode ? { indicatorCode: rawCode } : {}),
      ...(human.indicatorLabel ? {} : technical.indicatorLabel ? { indicatorLabel: technical.indicatorLabel } : {}),
    });
    alias.set(technicalId, humanId);
    keptById.delete(technicalId);
  }
}

function isProduceMirror(text, produceMirrors) {
  const value = normalized(text);
  if (!value) return false;
  return produceMirrors.some((item) => {
    const product = normalized(item);
    return product && (value === product || (value.startsWith(product) && value.length <= product.length + 14));
  });
}

function sanitizeSourceHtml(html, produceMirrors, investigationNumber) {
  return String(html ?? "")
    .replace(/<(p|li|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
      const text = universalHtmlText(inner);
      if (
        isStructuralText(text, investigationNumber)
        || isProduceMirror(text, produceMirrors)
        || (/^[☐□]\s*/u.test(text) && isProduceMirror(text.replace(/^[☐□]\s*/u, ""), produceMirrors))
      ) {
        return "";
      }
      return `<${tag}${attrs}>${String(inner).replace(/\*\*/g, "")}</${tag}>`;
    })
    .replace(/\*\*/g, "");
}

function actionPromptFromHtml(html, code, investigationNumber, existingPrompts) {
  const text = universalHtmlText(html);
  if (!text || text.length > 900) return null;

  const draw = text.match(/(?:Step\s*\d+\s*:\s*)?(Draw(?:\s+the)?\s+[^.]{3,80})\.?\s+(Draw\s+[^.?!]{8,300}[.?!]?)/i);
  if (draw) {
    const label = cleanLearnerText(draw[1]).replace(/^Draw\s+/i, "Map ");
    const prompt = cleanLearnerText(draw[2]);
    const duplicate = existingPrompts.some((item) => closeEnough(item.prompt, prompt) || closeEnough(item.label, label));
    if (!duplicate) {
      return {
        id: `${code}.I${investigationNumber}.ACTION.${stableToken(label + "|" + prompt)}`,
        label,
        prompt,
        type: "TEXT",
        placeholder: "Describe the system, its connections and the leverage point…",
        sensitivity: "P2",
        required: true,
        group: "Map your evidence",
        origin: "SOURCE",
      };
    }
  }
  return null;
}

function normalizeInvestigation(investigation, code) {
  const sourcePrompts = asArray(investigation?.prompts).map((prompt) => sanitizePrompt(prompt));
  const expanded = expandSemanticTables(
    asArray(investigation?.blocks),
    sourcePrompts,
    code,
    Number(investigation?.number),
  );
  const authoredPrompts = expanded.prompts;
  const promptById = new Map(authoredPrompts.map((prompt) => [String(prompt.id), prompt]));
  const allBlocks = expanded.blocks;
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
    const inheritedOptions = group.flatMap((prompt) => optionById.get(prompt.id) ?? asArray(prompt.options));
    const options = [...new Set(inheritedOptions.map(cleanOption).filter(Boolean))];
    const question = String(winner?.prompt ?? "").toLowerCase();
    const multi = /select all|choose all|tick all|which .* apply|any that apply|more than one/i.test(question);
    const prepared = {
      ...winner,
      ...(options.length >= 2 ? {
        type: multi ? "MULTI_SELECT" : winner.type === "BOOLEAN" ? "BOOLEAN" : "CATEGORICAL",
        ...(winner.type === "BOOLEAN" ? {} : { options }),
      } : {}),
    };
    keptById.set(String(winner.id), prepared);
    for (const prompt of group) alias.set(String(prompt.id), String(winner.id));
  }

  reconcileIndicatorDuplicates(keptById, alias, optionById);

  const rawProduces = asArray(investigation?.produces).map((value) => cleanLearnerText(value)).filter(Boolean);
  const produces = cleanProduces(investigation?.produces);
  const produceMirrors = [...rawProduces, ...produces];
  const emittedPrompts = new Set();
  const rendered = [];
  const flushHtml = (parts) => {
    if (!parts.length) return;
    const html = parts.join("");
    parts.length = 0;
    if (universalHtmlText(html)) rendered.push({ type: "HTML", html });
  };
  const htmlParts = [];

  for (let index = 0; index < workingBlocks.length; index += 1) {
    const block = workingBlocks[index];

    if (block?.type === "TABLE") {
      flushHtml(htmlParts);
      const rows = asArray(block.rows).map((row) => asArray(row).map((cell) => {
        if (cell?.kind !== "PROMPT") return cell;
        const mapped = alias.get(String(cell.promptId ?? "")) ?? String(cell.promptId ?? "");
        if (keptById.has(mapped)) emittedPrompts.add(mapped);
        return { ...cell, promptId: mapped };
      }));
      rendered.push({ ...block, rows });
      continue;
    }

    if (block?.type === "PROMPT") {
      flushHtml(htmlParts);
      const mapped = alias.get(String(block.promptId ?? "")) ?? String(block.promptId ?? "");
      if (!keptById.has(mapped) || emittedPrompts.has(mapped)) continue;
      emittedPrompts.add(mapped);
      rendered.push({ type: "PROMPT", promptId: mapped });
      continue;
    }

    if (block?.type !== "HTML") continue;
    const sanitizedHtml = sanitizeSourceHtml(block.html, produceMirrors, Number(investigation?.number));
    const text = universalHtmlText(sanitizedHtml);
    if (!text || isStructuralText(text, Number(investigation?.number)) || isProduceMirror(text, produceMirrors)) continue;

    const previous = workingBlocks[index - 1];
    if (previous?.type === "PROMPT" && parseCheckboxOptions(text).length >= 2) continue;

    const next = workingBlocks[index + 1];
    if (next?.type === "PROMPT") {
      const mapped = alias.get(String(next.promptId ?? "")) ?? String(next.promptId ?? "");
      const prompt = keptById.get(mapped) ?? promptById.get(String(next.promptId ?? ""));
      if (prompt && (closeEnough(text, prompt.prompt) || closeEnough(text, prompt.label))) continue;
      if (isToolHeading(text)) continue;
    }

    if (isToolHeading(text)) {
      if (/pause/i.test(text)) htmlParts.push('<div class="bis-source-pause-kicker">Pause</div>');
      continue;
    }

    const actionPrompt = actionPromptFromHtml(
      sanitizedHtml,
      code,
      Number(investigation?.number),
      [...keptById.values()],
    );
    if (actionPrompt && !keptById.has(actionPrompt.id)) {
      htmlParts.push(sanitizedHtml);
      flushHtml(htmlParts);
      keptById.set(actionPrompt.id, actionPrompt);
      emittedPrompts.add(actionPrompt.id);
      rendered.push({ type: "PROMPT", promptId: actionPrompt.id });
      continue;
    }

    htmlParts.push(sanitizedHtml);
  }
  flushHtml(htmlParts);

  for (const [id, prompt] of keptById) {
    if (emittedPrompts.has(id)) continue;
    if (prompt.origin !== "BIS_STANDARD" && prompt.readOnly !== true) continue;
    rendered.push({ type: "PROMPT", promptId: id });
    emittedPrompts.add(id);
  }

  const prompts = [...keptById.values()]
    .filter((prompt) => emittedPrompts.has(String(prompt.id)))
    .map((prompt) => {
      const { __technicalPresentation, ...clean } = prompt;
      void __technicalPresentation;
      return clean;
    });

  return {
    ...investigation,
    title: cleanLearnerText(investigation?.title),
    mission: cleanLearnerText(investigation?.mission),
    produces,
    prompts,
    blocks: rendered,
    __promptAliases: alias,
  };
}

function remapId(id, aliases, validIds) {
  const mapped = aliases.get(String(id ?? "")) ?? String(id ?? "");
  return validIds.has(mapped) ? mapped : null;
}

export function prepareUniversalLabPresentation(source) {
  const next = structuredClone(source);
  next.presentationBaseline = next.presentationBaseline ?? presentationBaseline(next);
  const aliases = new Map();
  const code = String(next?.identity?.code ?? "LAB").toUpperCase();
  next.investigations = asArray(next.investigations).map((investigation) => {
    const normalizedInvestigation = normalizeInvestigation(investigation, code);
    for (const [from, to] of normalizedInvestigation.__promptAliases ?? []) aliases.set(from, to);
    delete normalizedInvestigation.__promptAliases;
    return normalizedInvestigation;
  });

  const validIds = new Set([
    ...next.investigations.flatMap((investigation) => asArray(investigation.prompts).map((prompt) => String(prompt.id))),
    ...asArray(next.presentationBaseline?.items).map((prompt) => String(prompt.id)),
    ...(next.presentationBaseline?.metric ? [String(next.presentationBaseline.metric.id)] : []),
  ]);

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
