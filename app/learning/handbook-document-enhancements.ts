type LabCode = string;

export type HandbookKnownValue = {
  labels: string[];
  value: string;
  source?: string;
};

export type HandbookEnhancementContext = {
  knownValues?: HandbookKnownValue[];
  learnerName?: string;
  workbookId?: string;
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

function cleanOrphanedResponseControls(root: HTMLElement) {
  const fields = [...root.querySelectorAll<HTMLTextAreaElement>("textarea.response[data-field-id]")];
  for (const field of fields) {
    if (!field.isConnected || field.closest("td,th")) continue;
    const previous = field.previousElementSibling;
    if (
      previous instanceof HTMLTextAreaElement &&
      previous.matches("textarea.response[data-field-id]") &&
      isGenericResponse(previous) &&
      isGenericResponse(field)
    ) {
      field.remove();
    }
  }
}

function nearestPrompt(field: HTMLElement) {
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

    if (table.parentElement?.classList.contains("handbook-table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "handbook-table-scroll";
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

function replacePaperIdentityFields(root: HTMLElement, context: HandbookEnhancementContext) {
  root.querySelectorAll<HTMLElement>("p").forEach((element) => {
    const text = normalise(element.textContent ?? "");
    if (!text || element.dataset.digitalMeta === "true") return;

    if (/^from me,/i.test(text) && context.learnerName) {
      element.textContent = `From: ${context.learnerName}`;
      element.classList.add("handbook-digital-meta");
      element.dataset.digitalMeta = "true";
      return;
    }

    if (/^workbook id:\s*_+/i.test(text) && context.workbookId) {
      element.textContent = `Workbook ID: ${context.workbookId}`;
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
) {
  const token = hashPrompt(`${pageId}|paper-blank|${labelText}`);
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
    const input = createInlineResponse(labCode, pageId, labelText, inputType);
    element.append(label, input);
    if (suffix) {
      const suffixNode = document.createElement("small");
      suffixNode.textContent = suffix.replace(/\s+/g, " ");
      element.append(suffixNode);
    }
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
  upgradePrintableCheckboxes(root, pageId);
  enhanceTables(root);
  applyKnownValues(root, context);
  applyKnownTableValues(root, context);
  replacePaperIdentityFields(root, context);
  convertSimplePaperBlanks(root, labCode, pageId);
  hideEditorialProductionMetadata(root);
  softenLearnerTechnicalLabels(root);
  collapseSuggestedAnswers(root);
  addMissingCheckpointResponses(root, labCode, pageId);
}
