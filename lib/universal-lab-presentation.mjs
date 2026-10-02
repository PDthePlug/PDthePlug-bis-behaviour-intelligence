import { applyDigitalLabBaseline } from "./digital-lab-baseline.mjs";
import { applyHabitLabStandard } from "./universal-lab-standard.mjs";

const TOOL_HEADING = /^(?:📖|🤔|⏸|🔍|🔎|✍️|⚖️|🤝|📊|🌱|⭐|👁️|🧠)\s*/u;
const INDICATOR_CODE = /\b(?:BEI|TEI)-\d{2}(?:-(?:PRE|POST))?\b/i;
const INDICATOR_PREFIX = /^\s*(?:BEI|TEI)-\d{2}(?:-(?:PRE|POST))?\s*[:\-–—]?\s*/i;
const BLANK_CELL = /^(?:[_—–-]{2,}|\.{3,})$/u;
export const UNIVERSAL_LAB_PRESENTATION_VERSION = "bis-lab-presentation-5";

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
    prefix.flatMap((block) => {
      if (block?.type === "PROMPT") return [String(block.promptId ?? "")];
      return tablePromptIds(block);
    }),
  );
  const prompts = asArray(investigation.prompts)
    .filter((prompt) => promptIds.has(String(prompt.id)))
    .map((prompt) => sanitizePrompt(prompt));

  const editable = prompts.filter((prompt) => prompt.readOnly !== true);
  const metric = editable.find((prompt) =>
    /\b(?:BEI|TEI)-01\b/i.test(String(prompt.indicatorCode ?? ""))
    || /awareness index.*pre/i.test(String(prompt.indicatorLabel ?? ""))
    || /baseline\s*[—-]\s*pre/i.test(String(prompt.group ?? ""))
    || /\bpre\b/i.test(String(prompt.label ?? ""))
    || (
      prompt.type === "INTEGER"
      && Number(prompt.min ?? 1) <= 1
      && Number(prompt.max ?? 10) >= 10
      && /aware|starting point|where .* actually goes/i.test(String(prompt.prompt ?? ""))
    )
  ) ?? null;
  const items = editable.filter((prompt) =>
    prompt.id !== metric?.id
    && (
      Array.isArray(prompt.options)
      || prompt.type === "CATEGORICAL"
      || prompt.type === "BOOLEAN"
      || /baseline/i.test(String(prompt.group ?? ""))
    )
  );
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

  return dedupePresentationBaseline({ title, introduction, items, metric });
}

function dedupePresentationBaseline(baseline) {
  if (!baseline) return null;
  const seen = new Set();
  const items = asArray(baseline.items).filter((prompt) => {
    const options = asArray(prompt?.options).map(cleanOption).filter(Boolean).join("|").toLowerCase();
    const key = [
      normalized(prompt?.prompt || prompt?.label || prompt?.id),
      options,
    ].join("::");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const metricKey = baseline.metric
    ? normalized(baseline.metric.prompt || baseline.metric.label || baseline.metric.id)
    : "";
  return {
    ...baseline,
    items: metricKey
      ? items.filter((prompt) => normalized(prompt?.prompt || prompt?.label || prompt?.id) !== metricKey)
      : items,
  };
}

function repairLegacyDailyTracker(investigation) {
  if (Number(investigation?.number) !== 7) return investigation;
  const prompts = asArray(investigation?.prompts);
  const trackerHeader = /\b(?:date|moment|action|did i|did you|notes?|reflection|observation|situation|event|cue|decision|purchase|risk|what happened|what i noticed)\b/i;

  const coordinates = (prompt) => {
    const label = cleanLearnerText(prompt?.label ?? "");
    const question = cleanLearnerText(prompt?.prompt ?? "");
    const group = cleanLearnerText(prompt?.group ?? "");
    const explicit = Number(prompt?.scheduleDay ?? 0);
    const groupDay = group.match(/^Day\s+(\d{1,2})$/i)?.[1]
      ?? (/^\d{1,2}$/.test(group) ? group : "");
    const labelDay = /^\d{1,2}$/.test(label) ? label : "";
    const questionDay = question.match(/[—–-]\s*(\d{1,2})\s*$/u)?.[1] ?? "";
    const day = explicit || Number(groupDay || labelDay || questionDay || 0);

    const candidates = [
      question.replace(/[—–-]\s*\d{1,2}\s*$/u, "").trim(),
      labelDay ? group : label,
      groupDay && !/^Day\s+\d+/i.test(group) ? label : "",
      group,
    ].filter(Boolean);
    const header = candidates.find((value) => trackerHeader.test(value)) ?? "";

    return {
      day: Number.isInteger(day) && day >= 1 ? day : 0,
      header,
    };
  };

  const legacy = prompts
    .map((prompt) => ({ prompt, ...coordinates(prompt) }))
    .filter((item) => item.day > 0 && item.header);
  if (legacy.length < 2) return investigation;

  const mapped = prompts.map((prompt) => {
    if (prompt.scheduleEndDay) return prompt;
    const { day, header } = coordinates(prompt);
    if (!day || !header) return prompt;

    const group = `Day ${day}`;
    if (/\bdate\b/i.test(header)) {
      return {
        ...prompt,
        label: group + " date",
        prompt: header || "Date",
        type: "DATE",
        required: false,
        group,
        scheduleDay: day,
      };
    }
    const actionCheckbox = /^action$/i.test(header.trim())
      && /mark\s*[✓✔].*(?:acted|did).*?[✗✘]|mark\s*[✓✔].*?[✗✘]/i.test(
        asArray(investigation.blocks).filter((block) => block.type === "HTML")
          .map((block) => universalHtmlText(block.html)).join(" "),
      );
    if (prompt.type === "BOOLEAN" || actionCheckbox
      || /\b(?:did i|did you|acted|done|completed|followed|used|action check)\b|yes\s*\/?\s*no/i.test(header)) {
      return {
        ...prompt,
        label: group + " action check",
        prompt: header || "Did I act?",
        type: "BOOLEAN",
        required: true,
        group,
        scheduleDay: day,
      };
    }
    if (/\bnotes?|reflection|what helped|what got in the way\b/i.test(header)) {
      return {
        ...prompt,
        label: group + " notes",
        prompt: header || "Notes",
        type: "TEXT",
        required: false,
        group,
        scheduleDay: day,
      };
    }
    return {
      ...prompt,
      label: /\baction\b/i.test(header) ? group + " action" : group + " evidence",
      prompt: header || "What happened?",
      type: "TEXT",
      required: true,
      group,
      scheduleDay: day,
    };
  });

  return { ...investigation, prompts: mapped };
}

function repairWeeklyTracker(investigation, totalDays) {
  if (Number(investigation.number) !== 7) return investigation;
  const windows = new Map();
  for (const block of asArray(investigation.blocks)) {
    if (block.type !== "TABLE") continue;
    const weekColumn = asArray(block.headers).findIndex((header) => /^week$/i.test(header));
    if (weekColumn < 0) continue;
    const weeks = block.rows.map((row) => Number(row[weekColumn]?.text)).filter((week) => Number.isInteger(week) && week > 0);
    const lastWeek = Math.max(...weeks);
    for (const row of block.rows) {
      const week = Number(row[weekColumn]?.text);
      if (!weeks.includes(week)) continue;
      for (const cell of row) {
        if (cell.kind === "PROMPT") windows.set(String(cell.promptId), {
          group: `Week ${week}`,
          scheduleDay: (week - 1) * 7 + 1,
          scheduleEndDay: week === lastWeek ? Number(totalDays) || week * 7 : week * 7,
        });
      }
    }
  }
  if (!windows.size) return investigation;
  return { ...investigation, prompts: investigation.prompts.map((prompt) => {
    const window = windows.get(String(prompt.id));
    return window ? { ...prompt, ...window, required: !/\bdate|notes?\b/i.test(prompt.label) } : prompt;
  }) };
}

function repairExperimentSchedule(source) {
  if (source?.runtimeProfile !== "UNIVERSAL_V2") return source;
  const investigationNumber = Number(source?.experiment?.investigation ?? 7);
  const investigation = asArray(source?.investigations)
    .find((item) => Number(item?.number) === investigationNumber);
  if (!investigation) return source;

  const scheduled = [];
  for (const prompt of asArray(investigation.prompts)) {
    const explicit = Number(prompt?.scheduleDay ?? 0);
    const groupMatch = String(prompt?.group ?? "").match(/^Day\s+(\d+)$/i);
    const day = explicit || Number(groupMatch?.[1] ?? 0);
    if (!Number.isInteger(day) || day < 1) continue;
    prompt.scheduleDay = day;
    scheduled.push({ day, promptId: prompt.id, ...(prompt.scheduleEndDay ? { endDay: prompt.scheduleEndDay } : {}) });
  }
  if (!scheduled.length) return source;

  const inferredDays = Math.max(...scheduled.map((entry) => entry.day));
  source.experiment = {
    investigation: investigationNumber,
    startAfterInvestigation: Number(source?.experiment?.startAfterInvestigation ?? 6),
    days: Number(source?.experiment?.days ?? 0) || inferredDays,
    reviewInvestigation: Number(source?.experiment?.reviewInvestigation ?? 8),
    ...(source.experiment ?? {}),
    ...(scheduled.some((entry) => entry.endDay) ? { cadence: "WEEKLY" } : {}),
    scheduledPromptIds: scheduled,
  };
  return source;
}

function sanitizePrompt(prompt) {
  const rawLabel = String(prompt?.label ?? "");
  const rawPrompt = String(prompt?.prompt ?? "");
  const technical = INDICATOR_PREFIX.test(cleanLearnerText(rawLabel))
    || INDICATOR_PREFIX.test(cleanLearnerText(rawPrompt));
  const options = asArray(prompt?.options).map(cleanOption).filter(Boolean);
  let label = cleanLearnerText(rawLabel, { stripIndicator: true }) || "Your response";
  let question = cleanLearnerText(rawPrompt, { stripIndicator: true }) || label;
  if (technical && label === "Your response") {
    label = cleanLearnerText(prompt?.indicatorLabel, { stripIndicator: true }) || question;
  }

  if (technical && options.length === 2
      && options.map((item) => item.toLowerCase()).sort().join("|") === "correct|incorrect") {
    label = "Prediction check";
    question = "Was your prediction correct?";
  }

  const confidenceScale =
    /\bhow confident\b/i.test(`${label} ${question}`)
    && (prompt?.type === "TEXT" || !prompt?.type);

  return {
    ...prompt,
    label,
    prompt: question,
    ...(confidenceScale ? { type: "INTEGER", min: 1, max: 10 } : {}),
    ...(options.length ? { options } : prompt?.options ? { options: [] } : {}),
    __technicalPresentation: technical,
  };
}

function genericResponseLabel(value) {
  return /^(?:your|my)?\s*(?:response|answer|entry)|^write (?:your|an) answer$|^final reflection questions$|^(?:✍️\s*)?[_—–.\s]{3,}$/iu.test(
    cleanLearnerText(value, { stripIndicator: true }),
  );
}

function bindAuthoredResponseContext(investigation) {
  const prompts = asArray(investigation?.prompts).map((prompt) => ({ ...prompt }));
  const byId = new Map(prompts.map((prompt) => [String(prompt.id), prompt]));
  let previousHtml = "";
  for (const block of asArray(investigation?.blocks)) {
    if (block.type === "HTML") {
      previousHtml = String(block.html ?? "");
      continue;
    }
    if (block.type !== "PROMPT") continue;
    const prompt = byId.get(String(block.promptId));
    if (!prompt) continue;
    const paragraphs = [...previousHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
    const question = cleanLearnerText(universalHtmlText(paragraphs.at(-1)?.[1] ?? previousHtml))
      .replace(/^["“”]+|["“”]+$/gu, "")
      .replace(/^\d+[.)]\s*/u, "")
      .trim();
    if (genericResponseLabel(prompt.label) && question.endsWith("?") && question.length <= 700) {
      prompt.label = question;
      prompt.prompt = question;
      // A prose reflection following a rating is not another rating indicator.
      if (prompt.type === "TEXT") {
        delete prompt.indicatorCode;
        delete prompt.indicatorLabel;
      }
    }
    previousHtml = "";
  }
  return { ...investigation, prompts };
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
  if (exact >= 0) return exact + 1;
  // The Word adapter already removes investigation headings. Its baseline
  // still precedes the workshop body, so use that authored boundary as well.
  if (investigationNumber === 1) {
    const baseline = blocks.findIndex((block) => block?.type === "HTML"
      && /baseline\s*[—–-]\s*pre/i.test(universalHtmlText(block.html)));
    if (baseline >= 0) {
      const workshop = blocks.findIndex((block, index) => index > baseline
        && block?.type === "HTML"
        && /(?:^Workshop$|This is the .*workshop|Episode\s+1\s*:|📖\s*Read)/i.test(universalHtmlText(block.html)));
      if (workshop > baseline) return workshop;
    }
  }
  return 0;
}

function tablePromptIds(block) {
  if (block?.type !== "TABLE") return [];
  return asArray(block.rows)
    .flatMap((row) => asArray(row))
    .filter((cell) => cell?.kind === "PROMPT" || cell?.kind === "CHOICE")
    .map((cell) => String(cell.promptId ?? ""))
    .filter(Boolean);
}

function presentationPromptIds(blocks, prompts) {
  const fromBlocks = new Set();
  for (const block of blocks) {
    if (block?.type === "PROMPT") fromBlocks.add(String(block.promptId ?? ""));
    if (block?.type === "INLINE") {
      for (const segment of asArray(block.segments)) {
        if (segment.kind === "PROMPT") fromBlocks.add(String(segment.promptId));
      }
    }
    for (const id of tablePromptIds(block)) fromBlocks.add(id);
  }
  for (const prompt of prompts) {
    if ((prompt?.origin === "BIS_STANDARD" && prompt?.standardPurpose !== "DIGITAL_BASELINE") || prompt?.readOnly === true) fromBlocks.add(String(prompt.id ?? ""));
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
  return universalHtmlText(value)
    .replace(/\*+/g, "")
    .replace(/^\|+|\|+$/g, "")
    .replace(/\s+/g, " ")
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

function containsBlankMarker(value) {
  return /_{3,}|[—–-]{3,}|\.{4,}/u.test(cleanCell(value));
}

function checkboxChoices(value) {
  return [...String(value ?? "").matchAll(/[☐□]\s*([^☐□]+)/gu)]
    .map((match) => cleanLearnerText(match[1] ?? ""))
    .map((item) => item.replace(/^[-–—:|]+\s*/, "").trim())
    .filter(Boolean);
}

function singleCheckbox(value) {
  return /^[☐□]$/u.test(cleanCell(value));
}

function responseLike(value) {
  return blankLike(value) || containsBlankMarker(value) || checkboxChoices(value).length >= 2;
}

function rowDescriptor(row, columnIndex, rowIndex) {
  for (let index = 0; index < row.length; index += 1) {
    if (index === columnIndex) continue;
    const candidate = cleanCell(row[index])
      .replace(/_{3,}|[—–-]{3,}|\.{4,}/gu, " ")
      .replace(/[☐□]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (candidate && candidate.length <= 160) return candidate;
  }
  return `Entry ${rowIndex}`;
}

function tableCellPrompt(code, investigationNumber, headers, row, rowIndex, columnIndex, options = []) {
  const header = headers[columnIndex] || `Response ${columnIndex + 1}`;
  const rowLabel = rowDescriptor(row, columnIndex, rowIndex);
  const seed = [headers.join("|"), rowLabel, header, rowIndex, columnIndex].join("|");
  const id = `${code}.I${investigationNumber}.TABLE.${stableToken(seed)}`;
  const date = /\bdate\b/i.test(header);
  const choiceOptions = asArray(options).map(cleanOption).filter(Boolean);
  const yesNo = choiceOptions.length === 2
    && choiceOptions.map((item) => item.toLowerCase()).sort().join("|") === "no|yes";
  return {
    id,
    label: header,
    prompt: rowLabel && normalized(rowLabel) !== normalized(header)
      ? `${header} — ${rowLabel}`
      : header,
    type: choiceOptions.length ? (yesNo ? "BOOLEAN" : "CATEGORICAL") : date ? "DATE" : "TEXT",
    ...(choiceOptions.length && !yesNo ? { options: choiceOptions } : {}),
    placeholder: choiceOptions.length || date ? undefined : "Type your response…",
    sensitivity: "P2",
    required: true,
    group: rowLabel,
    origin: "SOURCE",
  };
}

function isLikertMatrix(headers, body) {
  if (headers.length < 4 || body.length < 2) return false;
  const optionHeaders = headers.slice(1).map((header) => normalized(header));
  const expected = ["never", "rarely", "sometimes", "often", "always"];
  const matchesExpected = expected.every((value) => optionHeaders.includes(value));
  if (!matchesExpected) return false;
  return body.every((row) =>
    cleanCell(row[0] ?? "")
    && row.slice(1, 6).every((cell) => singleCheckbox(cell)),
  );
}

function semanticTableBlock(tableHtml, code, investigationNumber, tableIndex) {
  const rows = parseTableRows(tableHtml);
  if (rows.length < 2 || rows[0].length < 2) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const headers = Array.from({ length: width }, (_, index) => cleanCell(rows[0][index] ?? "") || `Column ${index + 1}`);
  const body = rows.slice(1).map((row) => Array.from({ length: width }, (_, index) => cleanCell(row[index] ?? "")));
  const prompts = [];

  if (isLikertMatrix(headers, body)) {
    const options = headers.slice(1, 6);
    const renderedRows = body.map((row, rowIndex) => {
      const statement = cleanCell(row[0] ?? "") || `Item ${rowIndex + 1}`;
      const seed = [headers.join("|"), statement, rowIndex + 1].join("|");
      const id = `${code}.I${investigationNumber}.TABLE.${stableToken(seed)}`;
      prompts.push({
        id,
        label: statement,
        prompt: statement,
        type: "CATEGORICAL",
        options,
        sensitivity: "P2",
        required: true,
        group: "Baseline",
        origin: "SOURCE",
      });
      return [
        { kind: "TEXT", text: statement },
        ...options.map((value) => ({ kind: "CHOICE", promptId: id, value })),
      ];
    });
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

  const interactiveCount = body.reduce(
    (total, row) => total + row.filter((cell) => responseLike(cell)).length,
    0,
  );
  if (!interactiveCount) return null;

  const renderedRows = body.map((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      const choices = checkboxChoices(cell);
      if (choices.length >= 2) {
        const prompt = tableCellPrompt(
          code,
          investigationNumber,
          headers,
          row,
          rowIndex + 1,
          columnIndex,
          choices,
        );
        prompts.push(prompt);
        return { kind: "PROMPT", promptId: prompt.id };
      }
      if (!blankLike(cell) && !containsBlankMarker(cell)) return { kind: "TEXT", text: cell };
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
  let facilitatorRubric = false;

  for (const block of blocks) {
    if (block?.type === "HTML" && /Facilitator to assess/i.test(universalHtmlText(block.html))) facilitatorRubric = true;
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
      if (/data-bis-facilitator-rubric/i.test(part) || (facilitatorRubric && /Score\s*\(1[–-]5\)/i.test(universalHtmlText(part)))) {
        nextBlocks.push({ type: "HTML", html: /data-bis-facilitator-rubric/i.test(part) ? part : part.replace(/<table\b/i, '<table data-bis-facilitator-rubric="true"') });
        facilitatorRubric = false;
        continue;
      }
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

function escapePresentationText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function digitalizeSourceHtml(html) {
  return String(html ?? "")
    // Printed-workbook instructions become interface-appropriate language.
    .replace(/<p\b([^>]*)>\s*Close the workbook\.?\s*<\/p>/gi, '<p class="bis-digital-pause">Pause here.</p>')
    .replace(
      /<p\b([^>]*)>\s*This page becomes part of your Behaviour Profile\.?\s*<\/p>/gi,
      '<aside class="bis-profile-note">What you record here contributes to your Behaviour Profile.</aside>',
    )
    .replace(
      /<p\b([^>]*)>\s*\(?Draw your map in the space below\.?\)?\s*<\/p>/gi,
      '<p class="bis-digital-instruction">Build your map in the response area below.</p>',
    )
    // Word source files often carry section titles, experiment instructions and
    // paper-only commitment blanks as ordinary paragraphs. Preserve the authored
    // meaning while rendering them as digital interface structures.
    .replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
      const text = universalHtmlText(inner);
      if (!text) return match;

      if (/^Instructions\s*:/i.test(text) && text.length <= 760) {
        const instruction = text.replace(/^Instructions\s*:\s*/i, "").trim();
        return `<section class="bis-digital-instruction-panel"><span>How this works</span><p>${escapePresentationText(instruction)}</p></section>`;
      }

      if (/^["“]?Right now I feel like someone who\.\.\./i.test(text)) {
        return `<blockquote class="bis-reflection-stem">${escapePresentationText(text.replace(/^["“]|["”]$/gu, ""))}</blockquote>`;
      }

      if (
        text.length <= 180
        && !text.endsWith("?")
        && /\s(?:\+|=|→|↔)\s/u.test(text)
      ) {
        return `<div class="bis-digital-equation">${escapePresentationText(text)}</div>`;
      }

      const majorHeading =
        /^(?:Step\s+\d+\s*[:—–-]|Part\s+[A-Z]\s*[:—–-]|Episode\s+\d+\s*:)/i.test(text)
        || /^(?:Now It'?s Your Turn|Your Personal Equation|My Equation|My Commitment(?: Statement)?|Continue your journey|Try This at Work|Checkpoint|Example Equations?|Final Reflection Questions|BEHAVIOUR PROFILE SUMMARY|One Sentence That Describes Me Now|Letter to My Future Self|YOUR JOURNEY CONTINUES)(?:\s*:)?$/i.test(text)
        || /^My Meta-[A-Za-z -]+ Skill(?:\s*:)?$/i.test(text);
      if (majorHeading && text.length <= 120) {
        return `<h3 class="bis-digital-section-heading"${attrs}>${inner}</h3>`;
      }

      const minorHeading =
        /^(?:Ask yourself|What to notice|What to record|Before you continue|After you record|Evidence to collect|Supporting evidence|Your evidence|Your observation)(?:\s*:)?$/i.test(text);
      if (minorHeading && text.length <= 90) {
        return `<h4 class="bis-digital-subheading"${attrs}>${inner}</h4>`;
      }

      return match;
    });
}

function sanitizeSourceHtml(html, produceMirrors, investigationNumber) {
  const sanitized = String(html ?? "")
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
  return digitalizeSourceHtml(sanitized);
}

function inlineBlankLabel(before, after, index) {
  const left = cleanLearnerText(before)
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .replace(/^\u270D(?:\uFE0F)?\s*/u, "")
    .trim();
  const right = cleanLearnerText(after).replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  const tail = left.split(/[.!?]/u).at(-1)?.trim() ?? left;

  if (/\bstarting on\s*$/i.test(tail)) return { label: "Start date", type: "DATE" };
  if (/\bending on\s*$/i.test(tail)) return { label: "End date", type: "DATE" };
  if (/\b(?:signed|signature)\s*:?\s*$/i.test(tail)) return { label: "Signed name", type: "TEXT" };
  if (/\bdate\s*:?\s*$/i.test(tail)) return { label: "Date", type: "DATE" };
  if (/(?:^|\s)I,?\s*$/i.test(tail) || /\bname\s*:?\s*$/i.test(tail)) {
    return { label: "Name", type: "TEXT" };
  }
  if (/\b(?:I will|I commit|commitment|promise)\s*:?\s*$/i.test(tail)) {
    return { label: "Commitment", type: "TEXT" };
  }

  const readable = tail
    .replace(/\s*:\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    label: readable && readable.length <= 70 ? readable : `Response ${index + 1}`,
    type: /\bdate\b/i.test(`${readable} ${right}`) ? "DATE" : /^(?:minutes|hours|days|times)\b/i.test(right) ? "INTEGER" : "TEXT",
  };
}

function matchingInlinePrompt(existingPrompts, usedIds, spec) {
  const label = normalized(spec.label);
  return existingPrompts.find((prompt) => {
    if (usedIds.has(String(prompt.id))) return false;
    const candidate = normalized(prompt.label || prompt.prompt || "");
    if (!candidate) return false;
    if (candidate === label) return true;
    if (spec.label === "Name" && /^(?:i|name)$/.test(candidate)) return true;
    if (spec.label === "Signed name" && /^(?:signed|signature|signed name)$/.test(candidate)) return true;
    if (spec.label === "Date" && candidate === "date") return true;
    return false;
  }) ?? null;
}

function inlineBlankBlockFromHtml(html, code, investigationNumber, blockIndex, existingPrompts) {
  let text = universalHtmlText(html);
  const blanks = [...text.matchAll(/_{3,}|[—–-]{4,}/gu)];
  if (!blanks.length || text.length > 1200) return null;
  if (INDICATOR_CODE.test(text) || /\/\s*(?:5|7|10)\b/.test(text)) return null;
  if (/^(?:\u270D(?:\uFE0F)?\s*)?(?:_{3,}|[—–-]{4,}|\.{5,})$/u.test(text)) return null;

  text = text.replace(/^["“]+|["”]+$/g, "");
  const parts = text.split(/(_{3,}|[—–-]{4,})/gu);
  if (parts.length < 3) return null;

  const prompts = [];
  const usedIds = new Set();
  const segments = [];

  for (let index = 0; index < parts.length; index += 1) {
    if (index % 2 === 0) {
      if (parts[index]) segments.push({ kind: "TEXT", text: parts[index] });
      continue;
    }

    const before = parts.slice(0, index).filter((_, partIndex) => partIndex % 2 === 0).join("");
    const after = parts.slice(index + 1).filter((_, partIndex) => partIndex % 2 === 0).join("");
    const spec = inlineBlankLabel(before, after, prompts.length);
    const existing = matchingInlinePrompt(existingPrompts, usedIds, spec);
    const id = existing?.id
      ?? `${code}.I${investigationNumber}.INLINE.${stableToken(
        `${blockIndex}|${prompts.length}|${spec.label}|${text}`,
      )}`;
    usedIds.add(String(id));

    const prompt = {
      ...(existing ?? {}),
      id,
      label: spec.label,
      prompt: spec.label,
      type: spec.type,
      placeholder: spec.type === "DATE" ? undefined : spec.type === "INTEGER" ? "0" : "Your answer",
      sensitivity: existing?.sensitivity ?? "P2",
      required: existing?.required !== false,
      group: existing?.group ?? "Inline response",
      origin: existing?.origin ?? "SOURCE",
    };
    prompts.push(prompt);
    segments.push({ kind: "PROMPT", promptId: id });
  }

  if (!prompts.length) return null;
  return {
    block: {
      type: "INLINE",
      id: `${code}.I${investigationNumber}.INLINEBLOCK.${stableToken(`${blockIndex}|${text}`)}`,
      segments,
    },
    prompts,
  };
}

function actionPromptFromHtml(
  html,
  code,
  investigationNumber,
  existingPrompts,
  { blockIndex = 0, context = "" } = {},
) {
  const text = universalHtmlText(html);
  if (!text || text.length > 900) return null;

  const contextText = cleanLearnerText(context).replace(/[:.]+$/u, "").trim();
  const numbered = text.match(/^([1-9]\d?)[.)]\s*$/u);
  if (numbered) {
    const ordinal = Number(numbered[1]);
    const label = contextText ? `${contextText} ${ordinal}` : `Response ${ordinal}`;
    const id = `${code}.I${investigationNumber}.SCAFFOLD.${stableToken(`block:${blockIndex}|${label}`)}`;
    if (!existingPrompts.some((item) => String(item.id) === id)) {
      return {
        keepSourceHtml: false,
        contextLabel: null,
        prompt: {
          id,
          label,
          prompt: label,
          type: "TEXT",
          placeholder: "Write your response…",
          sensitivity: "P2",
          required: true,
          group: contextText || "Your response",
          origin: "SOURCE",
        },
      };
    }
  }

  const blankOnly = /^(?:\u270D(?:\uFE0F)?\s*)?(?:_{3,}|\.{5,}|[—–-]{3,})$/u.test(text);
  if (blankOnly) {
    const contextAlreadyHasControl = contextText && existingPrompts.some((item) =>
      closeEnough(item.prompt, contextText) || closeEnough(item.label, contextText),
    );
    if (contextAlreadyHasControl) {
      return { keepSourceHtml: false, contextLabel: null, prompt: null, representedByExistingControl: true };
    }
    const label = contextText || "Write your response";
    const id = `${code}.I${investigationNumber}.SCAFFOLD.${stableToken(`blank:${blockIndex}|${label}`)}`;
    return {
      keepSourceHtml: false,
      contextLabel: null,
      prompt: {
        id,
        label,
        prompt: label,
        type: "TEXT",
        placeholder: "Write your response…",
        sensitivity: "P2",
        required: true,
        group: contextText || "Your response",
        origin: "SOURCE",
      },
    };
  }

  const blankRuns = [...text.matchAll(/_{3,}|[—–-]{4,}/gu)];
  if (blankRuns.length && text.length <= 420) {
    const skeleton = cleanLearnerText(
      text
        .replace(/^\u270D(?:\uFE0F)?\s*/u, "")
        .replace(/_{3,}|[—–-]{4,}/gu, " … "),
    ).replace(/\s+/g, " ").trim();
    const comparable = cleanLearnerText(
      text
        .replace(/^\u270D(?:\uFE0F)?\s*/u, "")
        .replace(/_{3,}|[—–-]{4,}/gu, " "),
    );
    const duplicate = existingPrompts.some((item) => {
      const candidate = cleanLearnerText(item.prompt || item.label || "");
      return closeEnough(candidate, comparable)
        || (candidate.length >= 4 && normalized(comparable).includes(normalized(candidate)));
    });
    if (!duplicate) {
      const isDate = /^date\b/i.test(comparable);
      const isInteger = /\/\s*10\b|\bhow many\b|\bpeople influenced\b/i.test(comparable);
      const label = comparable.replace(/[:.]+$/u, "").trim() || contextText || "Your response";
      return {
        keepSourceHtml: blankRuns.length > 1,
        contextLabel: label,
        prompt: {
          id: `${code}.I${investigationNumber}.ACTION.${stableToken(`blank:${blockIndex}|${text}`)}`,
          label,
          prompt: skeleton || label,
          type: isDate ? "DATE" : isInteger ? "INTEGER" : "TEXT",
          ...(isInteger && /\/\s*10\b/.test(comparable) ? { min: 1, max: 10 } : {}),
          placeholder: "Write your response…",
          sensitivity: /identity|health|relationship/i.test(label) ? "P3" : "P2",
          required: true,
          group: contextText || "Your response",
          origin: "SOURCE",
        },
      };
    }
  }

  const draw = text.match(/(?:Step\s*\d+\s*:\s*)?(Draw(?:\s+the)?\s+[^.]{3,80})\.?\s+(Draw\s+[^.?!]{8,300}[.?!]?)/i);
  const hasAuthoredSourcePrompt = existingPrompts.some((prompt) => prompt?.origin === "SOURCE");
  if (draw && !hasAuthoredSourcePrompt) {
    const label = cleanLearnerText(draw[1]).replace(/^Draw\s+/i, "Map ");
    const prompt = cleanLearnerText(draw[2]);
    const duplicate = existingPrompts.some((item) => closeEnough(item.prompt, prompt) || closeEnough(item.label, label));
    if (!duplicate) {
      return {
        keepSourceHtml: true,
        contextLabel: label,
        prompt: {
          id: `${code}.I${investigationNumber}.ACTION.${stableToken(label + "|" + prompt)}`,
          label,
          prompt,
          type: "TEXT",
          placeholder: "Describe or sketch what you notice here…",
          sensitivity: "P2",
          required: true,
          group: "Map your evidence",
          origin: "SOURCE",
        },
      };
    }
  }

  const authoredText = cleanLearnerText(text).replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  const hadPenMarker = /^\u270D(?:\uFE0F)?\s*/u.test(authoredText);
  const learnerText = authoredText
    .replace(/^\u270D(?:\uFE0F)?\s*/u, "")
    .replace(/\s*_{3,}.*$/u, "")
    .trim();
  const reflectionStem = /^Right now I feel like someone who(?:\.{3}|…)?$/i.test(learnerText);
  const penResponse =
    hadPenMarker
    && learnerText.length >= 2
    && learnerText.length <= 180
    && !/^Complete this sentence\s*:?$/i.test(learnerText)
    && !/^(?:respond|reflect|write|record|map|draw|predict|commit|pause|read|observe|decide)\s*:?$/i.test(learnerText);
  const labelledResponse =
    /^(?:One .{2,100} I will\b.*|My .{2,100}(?:—\s*I will|:)\s*|What I will do if .{2,120}:\s*|Where I lead:\s*|How I lead:\s*|Most like a leader:\s*|Least like a leader:\s*|One thing to improve:\s*)$/i.test(learnerText);
  const pauseReflection =
    /^ask yourself\b/i.test(contextText)
    && learnerText.endsWith("?")
    && learnerText.length >= 12;

  if (reflectionStem || penResponse || labelledResponse || pauseReflection) {
    const label = reflectionStem
      ? "Today’s Insight"
      : pauseReflection
        ? learnerText
        : learnerText.replace(/\s*:\s*$/u, "").trim();
    const prompt = reflectionStem
      ? "Complete the sentence: Right now I feel like someone who…"
      : label;
    const duplicate = existingPrompts.some((item) =>
      closeEnough(item.prompt, prompt)
      || closeEnough(item.label, label)
      || closeEnough(item.prompt, learnerText)
      || closeEnough(item.label, learnerText),
    );
    if (!duplicate) {
      return {
        keepSourceHtml: false,
        contextLabel: label,
        prompt: {
          id: `${code}.I${investigationNumber}.ACTION.${stableToken(label + "|" + prompt)}`,
          label,
          prompt,
          type: "TEXT",
          placeholder: reflectionStem ? "Complete the sentence…" : "Write your response…",
          sensitivity: /identity|health|relationship/i.test(label) ? "P3" : "P2",
          required: true,
          group: reflectionStem ? "Reflection" : pauseReflection ? "Pause reflection" : "Your response",
          origin: "SOURCE",
        },
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
  const workingBlocks = allBlocks.slice(start).flatMap((block) => {
    if (block?.type !== "HTML") return [block];
    const html = String(block.html ?? "");
    const parts = html
      .split(/(<p\b[^>]*>[\s\S]*?<\/p>)/gi)
      .filter((part) => part.trim());
    return parts.length > 1
      ? parts.map((part) => ({ ...block, html: part }))
      : [block];
  });
  const eligibleIds = presentationPromptIds(workingBlocks, authoredPrompts);
  const optionById = inferOptions(workingBlocks, promptById);

  // Authored collection fields are never discarded merely because they came
  // from a paper-oriented layout. If the source asked the learner to provide
  // information, the digital Lab must preserve a control for it.
  const eligiblePrompts = authoredPrompts.filter((prompt) =>
    eligibleIds.has(String(prompt.id)),
  );
  const groups = new Map();
  for (const prompt of eligiblePrompts) {
    const baseKey = normalized(prompt?.prompt || prompt?.label || prompt?.id);
    const groupDay = String(prompt?.group ?? "").match(/^Day\s+(\d+)$/i)?.[1];
    const scheduleDay = Number(prompt?.scheduleDay ?? groupDay ?? 0);
    const key = Number.isInteger(scheduleDay) && scheduleDay > 0
      ? `${baseKey}::day:${scheduleDay}`
      : baseKey;
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
  const flushHtml = (parts, visibility = null) => {
    if (!parts.length) return;
    const html = parts.join("");
    parts.length = 0;
    if (universalHtmlText(html)) {
      rendered.push({
        type: "HTML",
        html,
        ...(visibility ? { visibility } : {}),
      });
    }
  };
  const htmlParts = [];
  let learnerContext = "";
  let deferAfterExperiment = false;

  for (let index = 0; index < workingBlocks.length; index += 1) {
    const block = workingBlocks[index];

    if (block?.type === "INLINE") {
      flushHtml(htmlParts);
      const segments = asArray(block.segments).map((segment) => {
        if (segment.kind !== "PROMPT") return segment;
        const mapped = alias.get(String(segment.promptId)) ?? String(segment.promptId);
        if (keptById.has(mapped)) emittedPrompts.add(mapped);
        return { ...segment, promptId: mapped };
      });
      rendered.push({ ...block, segments });
      continue;
    }

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
      const contextPrompt = keptById.get(mapped);
      const nextBlock = workingBlocks[index + 1];
      const introducesNumberedCollection =
        nextBlock?.type === "HTML"
        && /^[1-9]\d?[.)]\s*$/u.test(universalHtmlText(nextBlock.html));
      if (contextPrompt) learnerContext = cleanLearnerText(contextPrompt.label || contextPrompt.prompt || "");
      if (introducesNumberedCollection) {
        // A marker such as “Where I lead:” immediately before 1 / 2 / 3 is the
        // collection label, not an additional fourth response.
        continue;
      }
      emittedPrompts.add(mapped);
      const inlineStem = cleanLearnerText(contextPrompt?.prompt || contextPrompt?.label || "")
        .replace(/[:.]+$/u, "").trim();
      if (contextPrompt && !contextPrompt.readOnly
        && /^(?:signed|signature|date|from me, in grade)$|^(?:My .{2,100}—\s*I will|Right now I feel like someone who|I am becoming someone who)$/i.test(inlineStem)) {
        rendered.push({
          type: "INLINE",
          id: `${mapped}.SENTENCE`,
          segments: [{ kind: "TEXT", text: `${inlineStem}: ` }, { kind: "PROMPT", promptId: mapped }],
        });
      } else {
        rendered.push({ type: "PROMPT", promptId: mapped });
      }
      continue;
    }

    if (block?.type !== "HTML") continue;

    const rawHtml = String(block.html ?? "");
    const inline = inlineBlankBlockFromHtml(
      rawHtml,
      code,
      Number(investigation?.number),
      index,
      [...keptById.values()],
    );
    if (inline) {
      flushHtml(htmlParts, deferAfterExperiment ? "AFTER_EXPERIMENT" : null);
      for (const prompt of inline.prompts) {
        keptById.set(String(prompt.id), prompt);
        emittedPrompts.add(String(prompt.id));
      }
      rendered.push(inline.block);
      learnerContext = inline.prompts.at(-1)?.label ?? learnerContext;
      continue;
    }

    const numberedParagraphs = [
      ...rawHtml.matchAll(/<p\b[^>]*>\s*([1-9]\d?)[.)]\s*<\/p>/giu),
    ];
    if (numberedParagraphs.length) {
      const residualHtml = rawHtml.replace(/<p\b[^>]*>\s*[1-9]\d?[.)]\s*<\/p>/giu, "");
      const sanitizedResidual = sanitizeSourceHtml(
        residualHtml,
        produceMirrors,
        Number(investigation?.number),
      );
      if (universalHtmlText(sanitizedResidual)) htmlParts.push(sanitizedResidual);
      flushHtml(htmlParts);

      for (let scaffoldIndex = 0; scaffoldIndex < numberedParagraphs.length; scaffoldIndex += 1) {
        const ordinal = Number(numberedParagraphs[scaffoldIndex][1]);
        const contextText = cleanLearnerText(learnerContext).replace(/[:.]+$/u, "").trim();
        const label = contextText ? `${contextText} ${ordinal}` : `Response ${ordinal}`;
        const id = `${code}.I${Number(investigation?.number)}.SCAFFOLD.${stableToken(
          `block:${index}:${scaffoldIndex}|${label}`,
        )}`;
        if (keptById.has(id)) continue;
        const prompt = {
          id,
          label,
          prompt: label,
          type: "TEXT",
          placeholder: "Write your response…",
          sensitivity: "P2",
          required: true,
          group: contextText || "Your response",
          origin: "SOURCE",
        };
        keptById.set(id, prompt);
        emittedPrompts.add(id);
        rendered.push({ type: "PROMPT", promptId: id });
      }
      continue;
    }

    const sanitizedHtml = sanitizeSourceHtml(rawHtml, produceMirrors, Number(investigation?.number));
    const text = universalHtmlText(sanitizedHtml);
    if (!text || isStructuralText(text, Number(investigation?.number)) || isProduceMirror(text, produceMirrors)) continue;

    const previous = workingBlocks[index - 1];
    if (previous?.type === "PROMPT" && parseCheckboxOptions(text).length >= 2) continue;

    const next = workingBlocks[index + 1];
    if (next?.type === "PROMPT") {
      const mapped = alias.get(String(next.promptId ?? "")) ?? String(next.promptId ?? "");
      const prompt = keptById.get(mapped) ?? promptById.get(String(next.promptId ?? ""));
      if (prompt && (closeEnough(text, prompt.prompt) || closeEnough(text, prompt.label))) continue;
      const sourceQuestion = cleanLearnerText(text).replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
      if (
        prompt
        && genericResponseLabel(prompt.label)
        && sourceQuestion.endsWith("?")
        && sourceQuestion.length >= 12
        && sourceQuestion.length <= 420
      ) {
        keptById.set(mapped, {
          ...prompt,
          label: sourceQuestion,
          prompt: sourceQuestion,
        });
        continue;
      }
      if (isToolHeading(text)) continue;
    }

    if (
      Number(investigation?.number) === 7
      && /^Continue your journey\s*:?$/i.test(cleanLearnerText(text))
    ) {
      flushHtml(htmlParts);
      deferAfterExperiment = true;
      htmlParts.push(sanitizedHtml);
      flushHtml(htmlParts, "AFTER_EXPERIMENT");
      continue;
    }
    if (deferAfterExperiment) {
      htmlParts.push(sanitizedHtml);
      flushHtml(htmlParts, "AFTER_EXPERIMENT");
      continue;
    }

    const inferredAction = actionPromptFromHtml(
      sanitizedHtml,
      code,
      Number(investigation?.number),
      [...keptById.values()],
      { blockIndex: index, context: learnerContext },
    );
    if (inferredAction?.representedByExistingControl) {
      continue;
    }
    if (inferredAction?.prompt && !keptById.has(inferredAction.prompt.id)) {
      if (inferredAction.keepSourceHtml) htmlParts.push(sanitizedHtml);
      flushHtml(htmlParts);
      keptById.set(inferredAction.prompt.id, inferredAction.prompt);
      emittedPrompts.add(inferredAction.prompt.id);
      rendered.push({ type: "PROMPT", promptId: inferredAction.prompt.id });
      if (inferredAction.contextLabel) learnerContext = inferredAction.contextLabel;
      continue;
    }

    if (isToolHeading(text)) {
      if (/pause/i.test(text)) htmlParts.push('<div class="bis-source-pause-kicker">Pause</div>');
      continue;
    }

    htmlParts.push(sanitizedHtml);
    if (
      text.length <= 420
      && !/^(?:[1-9]\d?[.)]|(?:\u270D(?:\uFE0F)?\s*)?(?:_{3,}|\.{5,}|[—–-]{3,}))$/u.test(text)
    ) {
      learnerContext = text;
    }
  }
  flushHtml(htmlParts, deferAfterExperiment ? "AFTER_EXPERIMENT" : null);

  for (const [id, prompt] of keptById) {
    if (emittedPrompts.has(id)) continue;
    if (prompt.origin !== "BIS_STANDARD" && prompt.readOnly !== true) continue;
    rendered.push({ type: "PROMPT", promptId: id });
    emittedPrompts.add(id);
  }

  // One authored answer can be represented by both a compiled field and its
  // original inline/table form. Keep the structured control and alias the old
  // field; do not require the learner to answer the same activity twice.
  const structuredIds = new Set(rendered.flatMap((block) =>
    block.type === "INLINE" ? block.segments.filter((part) => part.kind === "PROMPT").map((part) => part.promptId)
      : block.type === "TABLE" ? block.rows.flat().filter((cell) => cell.kind === "PROMPT" || cell.kind === "CHOICE").map((cell) => cell.promptId) : []));
  const candidates = [...keptById.values()].filter((prompt) => emittedPrompts.has(String(prompt.id)));
  const canonical = [];
  for (const prompt of candidates.sort((a, b) => Number(structuredIds.has(b.id)) - Number(structuredIds.has(a.id)))) {
    const day = Number(prompt.scheduleDay ?? 0);
    const match = canonical.find((other) => !(structuredIds.has(other.id) && structuredIds.has(prompt.id)) && Number(other.scheduleDay ?? 0) === day && (
      normalized(other.label) === normalized(prompt.label)
      || (day > 0 && other.type === "BOOLEAN" && prompt.type === "BOOLEAN" && /action check/i.test(other.label) && /action check/i.test(prompt.label))
      || ((genericResponseLabel(other.label) || genericResponseLabel(prompt.label) || /evidence point/i.test(`${other.label} ${prompt.label}`)) && other.options?.length >= 2 && prompt.options?.length >= 2
        && JSON.stringify([...other.options].sort()) === JSON.stringify([...prompt.options].sort()))
    ));
    if (match) {
      if ((genericResponseLabel(match.label) || /evidence point/i.test(match.label)) && !genericResponseLabel(prompt.label) && !/evidence point/i.test(prompt.label)) {
        match.label = prompt.label;
        match.prompt = prompt.prompt;
      }
      alias.set(String(prompt.id), String(match.id)); emittedPrompts.delete(String(prompt.id));
    }
    else canonical.push(prompt);
  }
  const collectionGroups = new Set(canonical.filter((prompt) => prompt.id.includes(".SCAFFOLD.")).map((prompt) => normalized(prompt.group)));
  for (const prompt of canonical) {
    if (!structuredIds.has(prompt.id) && !prompt.id.includes(".SCAFFOLD.") && collectionGroups.has(normalized(prompt.label))) emittedPrompts.delete(String(prompt.id));
  }
  const seenControls = new Set();
  const structuredFirst = new Set([...structuredIds].map((id) => alias.get(id) ?? id));
  const uniqueBlocks = rendered.flatMap((block) => {
    if (block.type === "PROMPT") {
      const id = alias.get(block.promptId) ?? block.promptId;
      if (!emittedPrompts.has(id) || structuredFirst.has(id) || seenControls.has(id)) return [];
      seenControls.add(id); return [{ ...block, promptId: id }];
    }
    if (block.type === "INLINE") {
      const ids = block.segments.filter((part) => part.kind === "PROMPT").map((part) => alias.get(part.promptId) ?? part.promptId);
      if (ids.length && ids.every((id) => seenControls.has(id))) return [];
      ids.forEach((id) => seenControls.add(id));
      return [{ ...block, segments: block.segments.map((part) => part.kind === "PROMPT" ? { ...part, promptId: alias.get(part.promptId) ?? part.promptId } : part) }];
    }
    if (block.type === "TABLE") {
      return [{ ...block, rows: block.rows.map((row) => row.map((cell) => {
        if (cell.kind !== "PROMPT" && cell.kind !== "CHOICE") return cell;
        const id = alias.get(cell.promptId) ?? cell.promptId;
        seenControls.add(id); return { ...cell, promptId: id };
      })) }];
    }
    return [block];
  });

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
    blocks: uniqueBlocks,
    __promptAliases: alias,
  };
}

function remapId(id, aliases, validIds) {
  const mapped = aliases.get(String(id ?? "")) ?? String(id ?? "");
  return validIds.has(mapped) ? mapped : null;
}

export function prepareUniversalLabPresentation(source) {
  if (source?.presentationVersion === UNIVERSAL_LAB_PRESENTATION_VERSION) return source;

  // Re-apply the current BIS laboratory standard at runtime so already-published
  // source-backed Labs receive non-destructive standard improvements without
  // requiring their manuscript provenance to be rewritten or re-uploaded.
  const contextual = {
    ...source,
    investigations: asArray(source?.investigations).map(bindAuthoredResponseContext),
  };
  // Older compiled packages may already contain a standard prompt added because
  // the authored answer marker had lost its question. Prefer the recovered task.
  for (const investigation of contextual.investigations) {
    const authoredFalsification = investigation.prompts.some((prompt) =>
      prompt.origin !== "BIS_STANDARD" && /(?:evidence|prove).*wrong|disprov|falsif/i.test(prompt.prompt ?? ""));
    if (authoredFalsification) {
      const removed = new Set(investigation.prompts.filter((prompt) =>
        prompt.origin === "BIS_STANDARD" && prompt.standardPurpose === "FALSIFICATION").map((prompt) => prompt.id));
      investigation.prompts = investigation.prompts.filter((prompt) => !removed.has(prompt.id));
      investigation.blocks = asArray(investigation.blocks).filter((block) =>
        block.type !== "PROMPT" || !removed.has(block.promptId));
    }
  }
  const next = applyHabitLabStandard(applyDigitalLabBaseline(contextual));
  const aliases = new Map();
  const code = String(next?.identity?.code ?? "LAB").toUpperCase();

  next.investigations = asArray(next.investigations).map((investigation) => {
    const expanded = expandSemanticTables(
      asArray(investigation?.blocks),
      asArray(investigation?.prompts),
      code,
      Number(investigation?.number),
    );
    return repairLegacyDailyTracker(repairWeeklyTracker({
      ...investigation,
      blocks: expanded.blocks,
      prompts: expanded.prompts,
    }, next.experiment?.days));
  });
  repairExperimentSchedule(next);
  next.presentationBaseline = dedupePresentationBaseline(next.presentationBaseline ?? presentationBaseline(next));

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
        status: indicator.status === "NOT_COLLECTED" ? "NOT_COLLECTED" : promptIds.length ? "BOUND" : "UNBOUND",
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

  next.presentationVersion = UNIVERSAL_LAB_PRESENTATION_VERSION;
  return next;
}
