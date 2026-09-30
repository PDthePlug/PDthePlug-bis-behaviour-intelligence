import { learnerText, type LearnerEdition } from "../../lib/school-language";

type LabCode = string;

export type HandbookKnownValue = {
  labels: string[];
  value: string;
  source?: string;
};

export type HandbookEnhancementContext = {
  knownValues?: HandbookKnownValue[];
  learnerName?: string;
  labAvailable?: boolean;
  referenceOnly?: boolean;
  edition?: LearnerEdition;
};

const normalise = (value: string) => value.replace(/\s+/g, " ").trim();
const genericResponseLabel = /^(response|your response)$/i;
const printableBox = /^[□☐]\s*/;

function hashPrompt(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function questionPrompts(element: HTMLElement) {
  const rendered = (element.innerText || element.textContent || "").trim();
  if (!rendered) return [] as string[];

  const numbered = [...rendered.matchAll(/(?:^|\n)\s*\d+[.)]\s*([^\n]*?\?)(?=\s*(?:\n|$))/g)]
    .map((match) => normalise(match[1] ?? ""))
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  const plain = normalise(rendered);
  if (plain.endsWith("?") && plain.length <= 600) return [plain];
  return [] as string[];
}

function isAnswerHeading(element: HTMLElement) {
  return /^(answers?|suggested answers?)\s*:?\s*$/i.test(normalise(element.textContent ?? ""));
}

function isCheckpointHeading(element: HTMLElement) {
  return /^✅?\s*checkpoint\b/i.test(normalise(element.textContent ?? ""));
}

function isSectionBoundary(element: Element) {
  if (/^(H1|H2|H3|H4|HR)$/.test(element.tagName)) return true;
  if (element.classList.contains("prototype-lab-handoff")) return true;
  return isCheckpointHeading(element as HTMLElement);
}

function answerSummary() {
  const summary = document.createElement("summary");
  summary.innerHTML =
    '<span class="checkpoint-answer-label closed"><strong>Answers</strong><small>Tap to reveal</small></span>' +
    '<span class="checkpoint-answer-label open"><strong>Answers</strong><small>Tap to hide</small></span>';
  return summary;
}

function standardiseExistingAnswerPanels(root: HTMLElement) {
  root.querySelectorAll<HTMLDetailsElement>("details.answers, details.checkpoint-answer-panel").forEach((details) => {
    details.classList.add("checkpoint-answer-panel");
    const currentSummary = details.querySelector(":scope > summary");
    if (currentSummary && !currentSummary.querySelector(".checkpoint-answer-label")) {
      currentSummary.replaceWith(answerSummary());
    }
  });
}

function collapseSuggestedAnswers(root: HTMLElement) {
  standardiseExistingAnswerPanels(root);
  const candidates = [...root.querySelectorAll<HTMLElement>("p,h3,h4,div")];
  for (const heading of candidates) {
    if (!isAnswerHeading(heading) || heading.closest(".checkpoint-answer-panel")) continue;

    const parent = heading.parentElement;
    if (!parent) continue;
    const following: Element[] = [];
    let cursor = heading.nextElementSibling;
    while (cursor && !isSectionBoundary(cursor)) {
      following.push(cursor);
      cursor = cursor.nextElementSibling;
    }
    if (!following.length) continue;

    const details = document.createElement("details");
    details.className = "checkpoint-answer-panel";
    const body = document.createElement("div");
    body.className = "checkpoint-answer-body";

    parent.insertBefore(details, heading);
    details.append(answerSummary(), body);
    heading.remove();
    for (const node of following) body.append(node);
  }
}

function hasExistingAnswerSpace(element: HTMLElement) {
  if (element.querySelector("[data-field-id]")) return true;
  let cursor = element.nextElementSibling;
  let inspected = 0;
  while (cursor && inspected < 3) {
    if (cursor.matches("[data-field-id]") || cursor.querySelector("[data-field-id]")) return true;
    if (cursor.matches("h1,h2,h3,h4,hr,details") || isCheckpointHeading(cursor as HTMLElement)) break;
    if (questionPrompts(cursor as HTMLElement).length) break;
    inspected += 1;
    cursor = cursor.nextElementSibling;
  }
  return false;
}

function createResponse(
  labCode: LabCode,
  pageId: string,
  prompt: string,
  occurrence: number,
) {
  const token = hashPrompt(`${pageId}|${prompt}|${occurrence}`);
  const field = document.createElement("textarea");
  field.className = "response generated-question-response";
  field.dataset.fieldId = `${labCode}.WB.AUTO.${token}.${occurrence}`;
  field.dataset.sourceKey = `auto-question-${token.toLowerCase()}-${occurrence}`;
  field.dataset.purpose = "LEARNING_RESPONSE";
  field.dataset.privacyClass = "P3";
  field.maxLength = 20000;
  field.rows = 3;
  field.placeholder = "Write your answer…";
  field.setAttribute("aria-label", `Your answer: ${prompt}`);
  return field;
}

function checkpointQuestionElements(root: HTMLElement) {
  const result: HTMLElement[] = [];
  const headings = [...root.querySelectorAll<HTMLElement>("h1,h2,h3,h4")].filter(isCheckpointHeading);

  for (const heading of headings) {
    let cursor = heading.nextElementSibling;
    while (cursor) {
      if (cursor.matches("details.answers,details.checkpoint-answer-panel") || isAnswerHeading(cursor as HTMLElement)) break;
      if (/^(H1|H2|H3|H4|HR)$/.test(cursor.tagName)) break;

      if (cursor.matches("ol,ul")) {
        result.push(...cursor.querySelectorAll<HTMLElement>(":scope > li"));
      } else if (cursor.matches("p,li,.authored-lines,.handbook-callout")) {
        result.push(cursor as HTMLElement);
      }
      cursor = cursor.nextElementSibling;
    }
  }
  return result;
}

function addMissingCheckpointResponses(root: HTMLElement, labCode: LabCode, pageId: string) {
  const occurrences = new Map<string, number>();
  for (const element of checkpointQuestionElements(root)) {
    if (
      element.closest(".checkpoint-answer-panel") ||
      element.closest(".prototype-reference") ||
      element.closest(".prototype-lab-handoff") ||
      element.closest("summary") ||
      element.closest("textarea")
    ) continue;

    const prompts = questionPrompts(element);
    if (!prompts.length || hasExistingAnswerSpace(element)) continue;

    const responseGroup = document.createElement("div");
    responseGroup.className = "generated-question-responses";

    for (const prompt of prompts) {
      const seen = (occurrences.get(prompt) ?? 0) + 1;
      occurrences.set(prompt, seen);
      const wrapper = document.createElement("label");
      wrapper.className = "generated-question-response-row";
      if (prompts.length > 1) {
        const label = document.createElement("span");
        label.textContent = prompt;
        wrapper.append(label);
      }
      wrapper.append(createResponse(labCode, pageId, prompt, seen));
      responseGroup.append(wrapper);
    }

    if (element.tagName === "LI") element.append(responseGroup);
    else element.insertAdjacentElement("afterend", responseGroup);
  }
}

function isGenericResponse(field: HTMLElement) {
  const aria = normalise(field.getAttribute("aria-label") ?? "");
  return !aria || genericResponseLabel.test(aria);
}

function promptsBeforeResponseRun(field: HTMLTextAreaElement) {
  const previous = field.previousElementSibling as HTMLElement | null;
  if (!previous) return [] as string[];
  if (previous.matches("ol,ul")) {
    return [...previous.querySelectorAll<HTMLElement>(":scope > li")]
      .flatMap((item) => questionPrompts(item));
  }
  return questionPrompts(previous);
}

function cleanOrphanedResponseControls(root: HTMLElement) {
  const fields = [...root.querySelectorAll<HTMLTextAreaElement>("textarea.response[data-field-id]")];
  const handled = new Set<HTMLTextAreaElement>();

  for (const field of fields) {
    if (
      handled.has(field) ||
      !field.isConnected ||
      field.closest("td,th") ||
      !isGenericResponse(field)
    ) continue;

    const run = [field];
    let cursor = field.nextElementSibling;
    while (
      cursor instanceof HTMLTextAreaElement &&
      cursor.matches("textarea.response[data-field-id]") &&
      isGenericResponse(cursor)
    ) {
      run.push(cursor);
      cursor = cursor.nextElementSibling;
    }
    if (run.length < 2) continue;

    const prompts = promptsBeforeResponseRun(field);
    const keepCount = Math.min(run.length, Math.max(1, prompts.length));

    run.forEach((item, index) => {
      handled.add(item);
      if (index >= keepCount) {
        item.remove();
        return;
      }
      const prompt = prompts[index];
      if (prompt) {
        item.setAttribute("aria-label", prompt);
        item.placeholder = prompt.endsWith("?") ? "Write your answer…" : "Write your response…";
      }
    });
  }
}

function nearestPrompt(field: HTMLElement) {
  const parent = field.parentElement;
  if (parent && parent !== field.closest(".prototype-document")) {
    const parentText = normalise(parent.textContent ?? "").replace(/_+/g, "").trim();
    if (parentText && parentText.length <= 320) return parentText;
  }

  let cursor = field.previousElementSibling;
  let inspected = 0;
  while (cursor && inspected < 3) {
    if (cursor.matches("p,li,label,.prompt-line")) {
      const text = normalise(cursor.textContent ?? "");
      if (text && text.length <= 320) return text.replace(/_+/g, "").trim();
    }
    if (cursor.matches("h1,h2,h3,h4,hr")) break;
    cursor = cursor.previousElementSibling;
    inspected += 1;
  }
  return "";
}

function labelAuthoredResponses(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-field-id]").forEach((field) => {
    if (!isGenericResponse(field)) return;
    const prompt = nearestPrompt(field);
    if (!prompt) return;
    field.setAttribute("aria-label", prompt);
    if (field instanceof HTMLTextAreaElement && !field.placeholder) {
      field.placeholder = prompt.endsWith("?") ? "Write your answer…" : "Write your response…";
    }
  });
}

function removeUnboundGenericResponses(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-field-id]").forEach((field) => {
    if (!isGenericResponse(field)) return;
    if (field.closest("td,th")) return;
    if (field.dataset.purpose === "FORMAL_LAB_REFERENCE") return;
    if (nearestPrompt(field)) return;
    field.remove();
  });
}

function safeSessionRead(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionWrite(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // A private/session-restricted browser can still use the checkbox for the current render.
  }
}

function createUiChoice(pageId: string, textValue: string, exclusiveGroup?: string) {
  const label = document.createElement("label");
  label.className = "handbook-check-row";
  const input = document.createElement("input");
  const token = hashPrompt(`${pageId}|ui-check|${textValue}`);
  const storageKey = `bis:ui-check:${pageId}:${token}`;
  input.type = exclusiveGroup ? "radio" : "checkbox";
  input.name = exclusiveGroup ?? "";
  input.checked = safeSessionRead(storageKey) === "1";
  input.setAttribute("aria-label", textValue);
  input.addEventListener("change", () => {
    if (exclusiveGroup && input.checked) {
      label.parentElement?.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${exclusiveGroup}"]`).forEach((other) => {
        safeSessionWrite(
          `bis:ui-check:${pageId}:${hashPrompt(`${pageId}|ui-check|${other.getAttribute("aria-label") ?? ""}`)}`,
          other.checked ? "1" : "0",
        );
      });
    } else {
      safeSessionWrite(storageKey, input.checked ? "1" : "0");
    }
  });
  const text = document.createElement("span");
  text.textContent = textValue;
  label.append(input, text);
  return label;
}

function upgradePrintableCheckboxes(root: HTMLElement, pageId: string) {
  root.querySelectorAll<HTMLElement>(".authored-lines").forEach((block) => {
    if (block.dataset.digitalChecklist === "true") return;
    const lines = (block.textContent ?? "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (!lines.some((line) => printableBox.test(line))) return;

    block.textContent = "";
    block.dataset.digitalChecklist = "true";
    lines.forEach((line) => {
      if (printableBox.test(line)) {
        block.append(createUiChoice(pageId, line.replace(printableBox, "").trim()));
      } else {
        const row = document.createElement("div");
        row.className = "handbook-check-context";
        row.textContent = line;
        block.append(row);
      }
    });
  });

  root.querySelectorAll<HTMLElement>("p,li").forEach((element) => {
    if (element.dataset.digitalChecklist === "true" || element.querySelector("[data-field-id]")) return;
    const text = normalise(element.textContent ?? "");
    if (!text.includes("□") && !text.includes("☐")) return;

    const segments = text.split(/[□☐]/).map((item) => item.trim());
    const prefix = segments.shift() ?? "";
    const options = segments.filter(Boolean);
    if (!options.length) return;

    const exclusive = options.length === 2 && options.every((option) => /^(yes|no)\b/i.test(option));
    const group = exclusive ? `ui-choice-${hashPrompt(`${pageId}|${text}`)}` : undefined;
    element.textContent = "";
    element.dataset.digitalChecklist = "true";

    if (prefix) {
      const intro = document.createElement("span");
      intro.className = "handbook-check-context";
      intro.textContent = prefix;
      element.append(intro);
    }
    const list = document.createElement("span");
    list.className = "handbook-choice-list";
    options.forEach((option) => list.append(createUiChoice(pageId, option, group)));
    element.append(list);
  });
}

function enhanceTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const hasLabels = Boolean(table.querySelector("td[data-label],th[data-label]"));
    table.classList.toggle("handbook-data-table", hasLabels);
    table.classList.toggle("handbook-scroll-table", !hasLabels);

    // Keep column relationships intact, including merged cells. Narrow tables
    // reflow naturally; comparison and response tables scroll as one unit.
    const columns = Math.max(0, ...Array.from(table.rows, (row) =>
      Array.from(row.cells).reduce((count, cell) => count + cell.colSpan, 0)));
    table.classList.toggle("handbook-wide-table", columns > 2 || Boolean(table.querySelector("input,textarea,select")));
    table.querySelectorAll<HTMLTableCellElement>("thead th").forEach((cell) => {
      if (!cell.hasAttribute("scope")) cell.scope = cell.colSpan > 1 ? "colgroup" : "col";
    });

    if (table.parentElement?.classList.contains("handbook-table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "handbook-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    const title = normalise(table.caption?.textContent ?? "") ||
      normalise(table.querySelector("tr")?.textContent ?? "").slice(0, 120);
    wrapper.setAttribute("aria-label", `${title || "Learning table"} — scroll horizontally if needed`);
    table.parentElement?.insertBefore(wrapper, table);
    wrapper.append(table);
  });
}

function findKnownValue(text: string, context: HandbookEnhancementContext) {
  const normal = normalise(text).toLowerCase();
  return context.knownValues?.find((entry) =>
    entry.labels.some((label) => {
      const key = normalise(label).toLowerCase();
      return normal.startsWith(key) || normal.includes(`${key}:`);
    }),
  );
}

function renderKnownValue(element: HTMLElement, value: HandbookKnownValue) {
  const original = normalise(element.textContent ?? "");
  const labelText = original.includes(":") ? original.slice(0, original.indexOf(":")) : value.labels[0];
  element.textContent = "";
  element.classList.add("handbook-system-value");
  const label = document.createElement("span");
  label.textContent = labelText;
  const strong = document.createElement("strong");
  strong.textContent = value.value;
  element.append(label, strong);
  if (value.source) {
    const source = document.createElement("small");
    source.textContent = value.source;
    element.append(source);
  }
}

function applyKnownValues(root: HTMLElement, context: HandbookEnhancementContext) {
  if (!context.knownValues?.length) return;
  root.querySelectorAll<HTMLElement>("p,li").forEach((element) => {
    if (element.classList.contains("handbook-system-value") || element.querySelector("[data-field-id]")) return;
    const text = normalise(element.textContent ?? "");
    if (!text) return;
    const known = findKnownValue(text, context);
    if (known) renderKnownValue(element, known);
  });
}

function applyKnownTableValues(root: HTMLElement, context: HandbookEnhancementContext) {
  if (!context.knownValues?.length) return;
  root.querySelectorAll<HTMLTableRowElement>("table tr").forEach((row) => {
    const cells = [...row.querySelectorAll<HTMLElement>("th,td")];
    if (cells.length < 2) return;
    const labelCell = cells[0];
    const valueCell = cells[cells.length - 1];
    if (valueCell.querySelector("[data-field-id]") || valueCell.dataset.systemValue === "true") return;

    const labelText = normalise(labelCell.textContent ?? "");
    const currentValue = normalise(valueCell.textContent ?? "");
    const known = findKnownValue(labelText, context);
    if (!known) return;

    const replaceable =
      !currentValue ||
      /^[_\s/%0-9.–—-]+$/.test(currentValue) ||
      /^(?:n\/a|not recorded)$/i.test(currentValue);
    if (!replaceable) return;

    valueCell.textContent = "";
    valueCell.dataset.systemValue = "true";
    valueCell.classList.add("handbook-table-system-value");
    const strong = document.createElement("strong");
    strong.textContent = known.value;
    valueCell.append(strong);
    if (known.source) {
      const source = document.createElement("small");
      source.textContent = known.source;
      valueCell.append(source);
    }
  });
}

function replacePaperIdentityFields(
  root: HTMLElement,
  context: HandbookEnhancementContext,
  labCode: LabCode,
  pageId: string,
) {
  root.querySelectorAll<HTMLElement>("p").forEach((element) => {
    const text = normalise(element.textContent ?? "");
    if (!text || element.dataset.digitalMeta === "true") return;

    if (/^from me,\s*in grade\s*_+/i.test(text) && context.learnerName) {
      element.textContent = "";
      element.classList.add("handbook-inline-field", "handbook-letter-signoff");
      element.dataset.digitalMeta = "true";

      const from = document.createElement("span");
      from.textContent = `From: ${context.learnerName}`;
      const gradeLabel = document.createElement("label");
      gradeLabel.className = "handbook-priority-field";
      const label = document.createElement("span");
      label.textContent = "Grade";
      const grade = createInlineResponse(labCode, pageId, "Grade for future-self letter", "text");
      grade.inputMode = "numeric";
      grade.placeholder = "Your grade";
      gradeLabel.append(label, grade);
      element.append(from, gradeLabel);
      return;
    }

    if (/^from me,/i.test(text) && context.learnerName) {
      const remainder = text.replace(/^from me,?\s*/i, "").trim();
      element.textContent = remainder
        ? `From: ${context.learnerName} · ${remainder}`
        : `From: ${context.learnerName}`;
      element.classList.add("handbook-digital-meta");
      element.dataset.digitalMeta = "true";
      return;
    }

    if (/^workbook id:\s*_+/i.test(text)) {
      element.textContent = "Workbook record: linked to your BIS learning profile.";
      element.classList.add("handbook-digital-meta");
      element.dataset.digitalMeta = "true";
      return;
    }

    if (/^facilitator:\s*_+/i.test(text)) {
      element.textContent = "Facilitator confirmation: added by your programme facilitator.";
      element.classList.add("handbook-digital-meta");
      element.dataset.digitalMeta = "true";
      return;
    }

    if (/^signed:\s*_+/i.test(text) && context.learnerName) {
      element.textContent = `Participant: ${context.learnerName}`;
      element.classList.add("handbook-digital-meta");
      element.dataset.digitalMeta = "true";
      return;
    }

    if (/\bI,\s*_{3,}\s*,?\s*commit\b/i.test(text) && context.learnerName) {
      element.textContent = text.replace(/I,\s*_{3,}\s*,?/i, `I, ${context.learnerName},`);
      element.classList.add("handbook-digital-meta");
      element.dataset.digitalMeta = "true";
    }
  });
}

function createInlineResponse(
  labCode: LabCode,
  pageId: string,
  labelText: string,
  inputType: "text" | "number" | "date",
  identitySeed = labelText,
) {
  const token = hashPrompt(`${pageId}|paper-blank|${identitySeed}`);
  const input = document.createElement("input");
  input.className = "handbook-inline-response";
  input.type = inputType;
  input.dataset.fieldId = `${labCode}.WB.AUTO.BLANK.${token}`;
  input.dataset.sourceKey = `paper-blank-${token.toLowerCase()}`;
  input.dataset.purpose = "LEARNING_RESPONSE";
  input.dataset.privacyClass = "P3";
  input.setAttribute("aria-label", labelText);
  if (inputType === "number") input.inputMode = "numeric";
  return input;
}

function convertSimplePaperBlanks(root: HTMLElement, labCode: LabCode, pageId: string) {
  const occurrences = new Map<string, number>();
  root.querySelectorAll<HTMLElement>("p,li").forEach((element) => {
    if (
      element.dataset.digitalMeta === "true" ||
      element.classList.contains("handbook-system-value") ||
      element.closest(".prototype-reference") ||
      element.closest(".checkpoint-answer-panel")
    ) return;

    const text = normalise(element.textContent ?? "");
    const match = text.match(/^(.{2,150}?):\s*_{3,}\s*(%|\/\s*\d+)?\s*$/);
    if (!match) return;

    const labelText = normalise(match[1] ?? "");
    if (/^(facilitator|workbook id|signed)$/i.test(labelText)) return;

    const next = element.nextElementSibling as HTMLElement | null;
    if (next?.matches("[data-field-id]")) {
      element.textContent = `${labelText}:`;
      next.setAttribute("aria-label", labelText);
      element.classList.add("handbook-field-label");
      return;
    }

    element.textContent = "";
    element.classList.add("handbook-inline-field");
    const label = document.createElement("span");
    label.textContent = labelText;
    const suffix = normalise(match[2] ?? "");
    const inputType = /^date$/i.test(labelText)
      ? "date"
      : Boolean(suffix) || /(?:count|days|opportunities|rate|score|number|rating|percentage|percent)/i.test(labelText)
        ? "number"
        : "text";
    const occurrence = (occurrences.get(labelText) ?? 0) + 1;
    occurrences.set(labelText, occurrence);
    const input = createInlineResponse(
      labCode,
      pageId,
      labelText,
      inputType,
      `${labelText}|${occurrence}`,
    );
    element.append(label, input);
    if (suffix) {
      const suffixNode = document.createElement("small");
      suffixNode.textContent = suffix.replace(/\s+/g, " ");
      element.append(suffixNode);
    }
  });
}

function nearbyWorksheetContext(element: HTMLElement) {
  let cursor = element.previousElementSibling as HTMLElement | null;
  let inspected = 0;
  while (cursor && inspected < 6) {
    if (cursor.matches("h1,h2,h3,h4,hr")) break;
    const text = normalise(cursor.textContent ?? "").replace(/_+/g, "").trim();
    if (
      text.length > 2 &&
      text.length <= 180 &&
      (text.endsWith(":") ||
        /\b(options?|choices?|reasons?|examples?|evidence|goals?|what matters|information|consequences?|trade-offs?)\b/i.test(text))
    ) {
      return text.replace(/:\s*$/, "");
    }
    cursor = cursor.previousElementSibling as HTMLElement | null;
    inspected += 1;
  }
  return "";
}

function convertNumberedPaperBlanks(root: HTMLElement, labCode: LabCode, pageId: string) {
  root.querySelectorAll<HTMLElement>("p").forEach((element) => {
    if (element.dataset.digitalNumberedField === "true" || element.querySelector("[data-field-id]")) return;
    const text = normalise(element.textContent ?? "");
    const match = text.match(/^(\d+)[.)]\s*(?:_{3,})?$/);
    if (!match) return;
    const context = nearbyWorksheetContext(element);
    if (!context) return;

    const number = match[1];
    const labelText = `${context} — ${number}`;
    element.textContent = "";
    element.classList.add("handbook-inline-field", "handbook-numbered-field");
    element.dataset.digitalNumberedField = "true";

    const label = document.createElement("span");
    label.textContent = `${number}.`;
    const input = createInlineResponse(labCode, pageId, labelText, "text");
    input.placeholder = "Write your answer…";
    element.append(label, input);
  });
}

function createWorksheetSelect(labCode: LabCode, pageId: string, labelText: string) {
  const token = hashPrompt(`${pageId}|paper-select|${labelText}`);
  const select = document.createElement("select");
  select.className = "handbook-inline-response handbook-priority-select";
  select.dataset.fieldId = `${labCode}.WB.AUTO.SELECT.${token}`;
  select.dataset.sourceKey = `paper-select-${token.toLowerCase()}`;
  select.dataset.purpose = "LEARNING_RESPONSE";
  select.dataset.privacyClass = "P3";
  select.setAttribute("aria-label", labelText);

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Choose";
  select.append(empty);
  for (const option of ["High", "Medium", "Low"]) {
    const item = document.createElement("option");
    item.value = option;
    item.textContent = option;
    select.append(item);
  }
  return select;
}

function convertPriorityWorksheetRows(root: HTMLElement, labCode: LabCode, pageId: string) {
  let rowNumber = 0;
  root.querySelectorAll<HTMLElement>("p").forEach((element) => {
    if (element.dataset.digitalPriorityRow === "true" || element.querySelector("[data-field-id]")) return;
    const text = normalise(element.textContent ?? "");
    if (!/_ {0,1}/.test(text) && !text.includes("_")) return;
    if (!/High\s*\/\s*Medium\s*\/\s*Low/i.test(text)) return;
    if (!/_ {0,1}|_{3,}/.test(text)) return;

    rowNumber += 1;
    const context = nearbyWorksheetContext(element) || "What matters";
    element.textContent = "";
    element.classList.add("handbook-priority-row");
    element.dataset.digitalPriorityRow = "true";

    const matter = document.createElement("label");
    matter.className = "handbook-priority-field";
    const matterLabel = document.createElement("span");
    matterLabel.textContent = "What matters";
    const matterInput = createInlineResponse(
      labCode,
      pageId,
      `${context} row ${rowNumber} — what matters`,
      "text",
    );
    matter.append(matterLabel, matterInput);

    const importance = document.createElement("label");
    importance.className = "handbook-priority-field";
    const importanceLabel = document.createElement("span");
    importanceLabel.textContent = "Importance";
    importance.append(
      importanceLabel,
      createWorksheetSelect(labCode, pageId, `${context} row ${rowNumber} — importance`),
    );

    const option = document.createElement("label");
    option.className = "handbook-priority-field";
    const optionLabel = document.createElement("span");
    optionLabel.textContent = "Which option serves it?";
    const optionInput = createInlineResponse(
      labCode,
      pageId,
      `${context} row ${rowNumber} — option`,
      "text",
    );
    option.append(optionLabel, optionInput);

    element.append(matter, importance, option);
  });
}

function hardenReferenceOnlyLabContent(root: HTMLElement, context: HandbookEnhancementContext) {
  if (!context.referenceOnly || context.labAvailable !== false) return;

  root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p").forEach((element) => {
    const text = normalise(element.textContent ?? "");
    if (!text) return;

    if (/^you have completed .+ lab\.?$/i.test(text)) {
      element.textContent = "This section follows the Lab once it is available and completed.";
      element.classList.add("handbook-reference-copy");
      return;
    }
    if (/^you ran a 7-day experiment\.?$/i.test(text)) {
      element.textContent = "This review section is used after the seven-day Lab experiment.";
      element.classList.add("handbook-reference-copy");
      return;
    }
    if (/^you collected evidence\.?$/i.test(text)) {
      element.textContent = "The live Lab will provide the evidence used in this review.";
      element.classList.add("handbook-reference-copy");
      return;
    }
    if (/^(?:📖\s*)?the experiment is over$/i.test(text)) {
      element.textContent = "📖 After the Lab — Evidence Review";
      element.classList.add("handbook-reference-copy");
    }
  });

  root.querySelectorAll<HTMLElement>("p,li").forEach((element) => {
    if (
      element.classList.contains("handbook-system-value") ||
      element.querySelector("[data-field-id]")
    ) return;

    const text = normalise(element.textContent ?? "");
    const match = text.match(/^(.{2,170}?):\s*_{3,}(?:\s*(?:%|\/\s*\d+))?/);
    if (!match) return;

    const label = normalise(match[1] ?? "");
    if (!/(?:days?|opportunit|rate|accuracy|checks?|pauses?|outcomes?|prediction|completed|observed|missing|score|count)/i.test(label)) return;

    renderKnownValue(element, {
      labels: [label],
      value: "Available when the live Lab is connected",
      source: "Reference only",
    });
  });
}

function hideEditorialProductionMetadata(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p,div").forEach((element) => {
    if (element.children.length > 0 && !element.matches("p")) return;
    const text = normalise(element.textContent ?? "");
    if (
      /\bControlled Production Master\b/i.test(text) ||
      /\bArchitecture frozen\b/i.test(text) ||
      /\bProduction-freeze revision\b/i.test(text)
    ) {
      element.classList.add("handbook-production-metadata");
      element.hidden = true;
    }
  });
}

function applyEditionLearnerLanguage(root: HTMLElement, context: HandbookEnhancementContext) {
  if (!context.edition) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    const parent = text.parentElement;
    if (
      parent &&
      !["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"].includes(parent.tagName) &&
      !parent.closest("[data-edition-language='keep-technical']") &&
      !parent.closest("[data-school-language='keep-technical']")
    ) {
      nodes.push(text);
    }
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const before = node.nodeValue ?? "";
    const after = learnerText(before, context.edition);
    if (after !== before) node.nodeValue = after;
  }

  root.querySelectorAll<HTMLElement>("[aria-label],[title],[placeholder]").forEach((element) => {
    if (
      element.closest("[data-edition-language='keep-technical']") ||
      element.closest("[data-school-language='keep-technical']")
    ) return;
    for (const attribute of ["aria-label", "title", "placeholder"] as const) {
      const before = element.getAttribute(attribute);
      if (!before) continue;
      const after = learnerText(before, context.edition);
      if (after !== before) element.setAttribute(attribute, after);
    }
  });
}

function softenLearnerTechnicalLabels(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p,h2,h3,h4").forEach((element) => {
    const text = normalise(element.textContent ?? "");
    if (/^Registry rules:?$/i.test(text)) element.textContent = "How BIS handles this calculation";
  });
}

export function enhanceHandbookDocument(
  root: HTMLElement,
  labCode: LabCode,
  pageId: string,
  context: HandbookEnhancementContext = {},
) {
  cleanOrphanedResponseControls(root);
  labelAuthoredResponses(root);
  removeUnboundGenericResponses(root);
  upgradePrintableCheckboxes(root, pageId);
  enhanceTables(root);
  applyKnownValues(root, context);
  applyKnownTableValues(root, context);
  replacePaperIdentityFields(root, context, labCode, pageId);
  hardenReferenceOnlyLabContent(root, context);
  convertSimplePaperBlanks(root, labCode, pageId);
  convertNumberedPaperBlanks(root, labCode, pageId);
  convertPriorityWorksheetRows(root, labCode, pageId);
  hideEditorialProductionMetadata(root);
  softenLearnerTechnicalLabels(root);
  applyEditionLearnerLanguage(root, context);
  collapseSuggestedAnswers(root);
  addMissingCheckpointResponses(root, labCode, pageId);
}
