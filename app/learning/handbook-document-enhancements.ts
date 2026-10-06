import { learnerText, type LearnerEdition } from "../../lib/school-language";
import { authoredQuestions } from "../../lib/universal-lab-presentation.mjs";
import { BIS_LEARNING_SESSION_MINUTES } from "../../lib/session-design";
import { learnerHeadingText } from "../../lib/learner-heading-presentation.mjs";

type LabCode = string;

export type HandbookKnownValue = {
  labels: string[];
  exact?: boolean;
  value: string;
  source?: string;
};

export type HandbookEnhancementContext = {
  knownValues?: HandbookKnownValue[];
  learnerName?: string;
  labAvailable?: boolean;
  referenceOnly?: boolean;
  edition?: LearnerEdition;
  programmeDay?: number | null;
  pageTitle?: string;
  formativeCheckTarget?: number;
  enableFormativeLearningChecks?: boolean;
  facilitatorMode?: boolean;
  facilitatorGuidance?: {
    discussionMove?: string;
  };
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
  if (numbered.length > 1) return numbered.flatMap(prompt => authoredQuestions(prompt));

  const plain = normalise(rendered);
  if (plain.replace(/["“”'‘’]+$/g, "").endsWith("?") && plain.length <= 600) return authoredQuestions(plain);
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

function existingAnswerSpace(element: HTMLElement): HTMLElement | null {
  if (element.querySelector("[data-field-id]")) return element;
  let cursor = element.nextElementSibling;
  let inspected = 0;
  while (cursor && inspected < 3) {
    if (cursor.matches("[data-field-id]") || cursor.querySelector("[data-field-id]")) return cursor as HTMLElement;
    if (cursor.matches("h1,h2,h3,h4,hr,details") || isCheckpointHeading(cursor as HTMLElement)) break;
    if (questionPrompts(cursor as HTMLElement).length) break;
    inspected += 1;
    cursor = cursor.nextElementSibling;
  }
  return null;
}

function hasExistingAnswerSpace(element: HTMLElement) {
  return Boolean(existingAnswerSpace(element));
}

const learningCheckListeners = new WeakSet<HTMLElement>();

/** A support check follows the written response, including restored answers. */
export function syncHandbookLearningChecks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-formative-signal-for]").forEach(signal => {
    const checkId = signal.dataset.formativeSignalFor;
    const fields = [...root.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(`[data-response-check="${checkId}"]`)];
    signal.hidden = !fields.length || fields.some(field => !field.value.trim());
  });
}

function removeInstructionResponseControls(root: HTMLElement) {
  root.querySelectorAll<HTMLTextAreaElement>("textarea.response[data-field-id]").forEach(field => {
    const prompt = normalise(field.getAttribute("aria-label") || nearestPrompt(field));
    // A source list introduction is reading, not a learner task. Saved records
    // remain untouched; this removes only the misplaced presentation control.
    if (/^(do not use .* to experiment with .* involves|before you begin .* read this carefully)\s*[:.]?$/i.test(prompt)) {
      field.remove();
    }
  });
}

function createResponse(
  labCode: LabCode,
  pageId: string,
  prompt: string,
  occurrence: number,
  purpose = "LEARNING_RESPONSE",
  identitySeed = prompt,
  metadata: { checkId?: string; checkKind?: string } = {},
) {
  const token = hashPrompt(`${pageId}|${identitySeed}|${occurrence}`);
  const field = document.createElement("textarea");
  field.className = "response generated-question-response";
  field.dataset.fieldId = `${labCode}.WB.AUTO.${token}.${occurrence}`;
  field.dataset.sourceKey = `auto-question-${token.toLowerCase()}-${occurrence}`;
  field.dataset.purpose = purpose;
  field.dataset.privacyClass = "P3";
  if (metadata.checkId) field.dataset.checkId = metadata.checkId;
  if (metadata.checkKind) field.dataset.checkKind = metadata.checkKind;
  field.maxLength = 20000;
  field.rows = 3;
  field.placeholder = "Write your answer…";
  field.setAttribute("aria-label", `Your answer: ${prompt}`);
  return field;
}

function interleavedQuestionCandidates(root: HTMLElement) {
  const endCheckpointQuestions = new Set(checkpointQuestionElements(root));
  return [...root.querySelectorAll<HTMLElement>("p,li,.authored-lines,.handbook-callout")]
    .filter((element) => questionPrompts(element).length > 0)
    .filter((element) =>
      !endCheckpointQuestions.has(element) &&
      !element.closest(".checkpoint-answer-panel") &&
      !element.closest(".prototype-reference") &&
      !element.closest(".prototype-lab-handoff") &&
      !element.closest("summary,table,details") &&
      !isCheckpointHeading(element),
    );
}

function distributedConceptChecks(candidates: HTMLElement[], target = 3) {
  if (candidates.length <= target) return candidates;
  const selected = new Set<HTMLElement>();
  for (let step = 1; step <= target; step += 1) {
    const position = step / (target + 1);
    const index = Math.min(candidates.length - 1, Math.max(0, Math.round(position * (candidates.length - 1))));
    selected.add(candidates[index]);
  }
  return [...selected];
}

type FormativeCheckKind =
  | "RECALL"
  | "UNDERSTAND"
  | "DISTINGUISH"
  | "PREDICT"
  | "APPLY"
  | "CHALLENGE"
  | "CONFIDENCE";

function formativeCheckKind(prompt: string, order: number, programmeDay?: number | null): FormativeCheckKind {
  if (/\b(confiden(?:ce|t)|how sure|how certain)\b/i.test(prompt)) return "CONFIDENCE";
  if (/\b(evidence|challenge|disprove|less convincing|against this|what would change)\b/i.test(prompt)) return "CHALLENGE";
  if (/\b(predict|what do you think|what happens next|what will|likely happen)\b/i.test(prompt)) return "PREDICT";
  if (/\b(distinguish|difference|compare|which .* (?:and|from) which)\b/i.test(prompt)) return "DISTINGUISH";
  if (/\b(your|you|apply|in your own|for you)\b/i.test(prompt)) return "APPLY";
  if ((programmeDay ?? 1) > 1 && order === 0) return "RECALL";
  return "UNDERSTAND";
}

function formativeCheckLabel(kind: FormativeCheckKind) {
  return ({
    RECALL: "Recall",
    UNDERSTAND: "Understand",
    DISTINGUISH: "Distinguish",
    PREDICT: "Predict",
    APPLY: "Apply",
    CHALLENGE: "Challenge",
    CONFIDENCE: "Confidence",
  } as const)[kind];
}

function createFormativeSignal(
  labCode: LabCode,
  pageId: string,
  checkId: string,
  checkKind: FormativeCheckKind,
) {
  const fieldId = `${labCode}.WB.CHECK.${checkId}.SIGNAL`;
  const group = document.createElement("fieldset");
  group.className = "handbook-formative-signal";
  group.dataset.formativeSignalFor = checkId;

  const legend = document.createElement("legend");
  legend.textContent = "After answering, how clear does this feel?";
  group.append(legend);

  const options = document.createElement("div");
  options.className = "handbook-formative-signal-options";
  const choices = [
    ["UNDERSTOOD", "I understand this"],
    ["UNSURE", "I’m unsure"],
    ["NEEDS_EXAMPLE", "I need another example"],
  ] as const;

  for (const [value, labelText] of choices) {
    const label = document.createElement("label");
    label.className = "handbook-formative-signal-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = fieldId;
    input.value = value;
    input.dataset.fieldId = fieldId;
    input.dataset.sourceKey = `formative-signal-${checkId.toLowerCase()}`;
    input.dataset.purpose = "FORMATIVE_SIGNAL";
    input.dataset.privacyClass = "P2";
    input.dataset.checkId = checkId;
    input.dataset.checkKind = checkKind;
    input.setAttribute("aria-label", labelText);
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(input, span);
    options.append(label);
  }

  group.append(options);
  return group;
}

function addInterleavedConceptChecks(
  root: HTMLElement,
  labCode: LabCode,
  pageId: string,
  context: HandbookEnhancementContext,
) {
  // React may restore values or update shared context without replacing the
  // document. Do not choose a second set from the already-enhanced markup.
  if (root.querySelector("[data-formative-signal-for]")) return;
  const candidates = interleavedQuestionCandidates(root);
  const target = Math.max(2, Math.min(4, context.formativeCheckTarget ?? 3));
  const selected = distributedConceptChecks(candidates, target);
  const occurrences = new Map<string, number>();

  selected.forEach((element, order) => {
    const prompts = questionPrompts(element);
    if (!prompts.length) return;
    const primaryPrompt = prompts[0];
    const checkKind = formativeCheckKind(primaryPrompt, order, context.programmeDay);
    const checkId = hashPrompt(`formative|${pageId}|${primaryPrompt}|${order + 1}`);

    if (element.dataset.conceptCheck !== "true") {
      element.dataset.conceptCheck = "true";
      element.dataset.checkId = checkId;
      element.dataset.checkKind = checkKind;
      element.classList.add("handbook-concept-check-question");

      const label = document.createElement("div");
      label.className = "handbook-concept-check-label";
      const title = document.createElement("strong");
      title.textContent = formativeCheckLabel(checkKind);
      label.append(title);

      if (element.tagName === "LI") element.prepend(label);
      else element.insertAdjacentElement("beforebegin", label);
    }

    if (!hasExistingAnswerSpace(element)) {
      const responseGroup = document.createElement("div");
      responseGroup.className = "generated-question-responses handbook-concept-check-responses";

      for (const prompt of prompts) {
        const seen = (occurrences.get(prompt) ?? 0) + 1;
        occurrences.set(prompt, seen);
        const wrapper = document.createElement("label");
        wrapper.className = "generated-question-response-row";
        if (prompts.length > 1) {
          const promptLabel = document.createElement("span");
          promptLabel.textContent = prompt;
          wrapper.append(promptLabel);
        }
        wrapper.append(
          createResponse(
            labCode,
            pageId,
            prompt,
            seen,
            "FORMATIVE_CHECK",
            `formative|${prompt}`,
            { checkId, checkKind },
          ),
        );
        responseGroup.append(wrapper);
      }

      if (element.tagName === "LI") element.append(responseGroup);
      else element.insertAdjacentElement("afterend", responseGroup);
    }

    if (!root.querySelector(`[data-formative-signal-for="${checkId}"]`)) {
      const signal = createFormativeSignal(labCode, pageId, checkId, checkKind);
      const answer = existingAnswerSpace(element);
      answer?.querySelectorAll<HTMLElement>("[data-field-id]").forEach(field => { field.dataset.responseCheck = checkId; });
      if (answer?.matches("[data-field-id]")) answer.dataset.responseCheck = checkId;
      if (element.tagName === "LI") element.append(signal);
      else (answer ?? element).insertAdjacentElement("afterend", signal);
    }
  });
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
  // A response following an authored choice list belongs to its introduction,
  // rather than acquiring the final choice as a second, unrelated question.
  let choice = field.previousElementSibling;
  if (choice?.matches("p.choice-line") && printableBox.test(normalise(choice.textContent ?? ""))) {
    while (choice?.matches("p.choice-line")) choice = choice.previousElementSibling;
    const introduction = normalise(choice?.textContent ?? "");
    if (choice?.matches("p") && introduction.endsWith(":") && introduction.length <= 320) return introduction;
  }
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

/** Keep original bindings and saved answers; additional questions get stable suffixes. */
function structureAuthoredResponses(root: HTMLElement) {
  for (const field of root.querySelectorAll<HTMLTextAreaElement>("textarea.response[data-field-id]")) {
    if (field.closest("table,.checkpoint-answer-panel,.prototype-reference,.prototype-lab-handoff,label")) continue;
    if (field.dataset.purpose === "FORMAL_LAB_REFERENCE") continue;
    const prompt = normalise(field.getAttribute("aria-label") || nearestPrompt(field));
    if (!prompt || genericResponseLabel.test(prompt)) continue;
    const questions = authoredQuestions(prompt);
    const parts = questions.length > 1 ? questions : [prompt.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")];
    const group = document.createElement("div");
    group.className = "generated-question-responses authored-response-group";
    const preceding = field.previousElementSibling;
    field.before(group);
    parts.forEach((question, index) => {
      const control = index === 0 ? field : field.cloneNode(false) as HTMLTextAreaElement;
      if (index > 0) {
        control.dataset.fieldId = `${field.dataset.fieldId}.PART.${index + 1}`;
        control.dataset.sourceKey = `${field.dataset.sourceKey || "authored-response"}-part-${index + 1}`;
        control.value = "";
        control.removeAttribute("id");
      }
      control.rows = 3;
      control.setAttribute("aria-label", question);
      const wrapper = document.createElement("label");
      wrapper.className = "generated-question-response-row";
      const title = document.createElement("span");
      title.textContent = question;
      wrapper.append(title, control);
      group.append(wrapper);
    });
    // Only consume the exact authored prompt, never nearby narrative or headings.
    if (preceding?.matches("p") && normalise(preceding.textContent || "").replace(/^["“”'‘’]+|["“”'‘’]+$/g, "") === prompt.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")) preceding.remove();
  }
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
    let previousChoice: HTMLLabelElement | null = null;
    lines.forEach((line) => {
      if (printableBox.test(line)) {
        previousChoice = createUiChoice(pageId, line.replace(printableBox, "").trim());
        block.append(previousChoice);
      } else if (previousChoice && /^[a-z]/.test(line)) {
        // Source line wrapping is not a new learning objective. Keep its
        // continuation inside the same label without changing the choice key.
        previousChoice.append(document.createTextNode(` ${line}`));
        previousChoice.querySelector("input")?.setAttribute("aria-label", normalise(previousChoice.textContent ?? ""));
      } else {
        previousChoice = null;
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

function tableResponseHeader(value: string) {
  const header = normalise(value).toLowerCase();
  if (!header) return false;
  return /^(?:your|my)\b/.test(header)
    || /\b(?:your|my)\s+(?:answer|response|cue|entry|note|notes|action|evidence|example|value|observation|reflection|plan)\b/.test(header);
}

function blankWorkbookCell(value: string) {
  const text = normalise(value)
    .replace(/[_—–-]{2,}/g, "")
    .replace(/\.{3,}/g, "")
    .trim();
  return text === "";
}

function createTableResponse(
  labCode: LabCode,
  pageId: string,
  prompt: string,
  identitySeed: string,
  multiline: boolean,
) {
  const token = hashPrompt(`${pageId}|table-cell|${identitySeed}`);
  const field = multiline ? document.createElement("textarea") : document.createElement("input");
  field.className = multiline
    ? "response compiled-workbook-response handbook-table-response"
    : "handbook-inline-response handbook-table-response";
  field.dataset.fieldId = `${labCode}.WB.AUTO.TABLE.${token}`;
  field.dataset.sourceKey = `table-cell-${token.toLowerCase()}`;
  field.dataset.purpose = "LEARNING_RESPONSE";
  field.dataset.privacyClass = "P3";
  field.setAttribute("aria-label", prompt);
  if (field instanceof HTMLTextAreaElement) {
    field.rows = 2;
    field.maxLength = 20000;
    field.placeholder = "Write your response…";
  } else {
    field.type = "text";
    field.placeholder = "Write here…";
  }
  return field;
}

function makeBlankLearnerTableCellsEditable(table: HTMLTableElement, labCode: LabCode, pageId: string, usedFieldIds: Set<string>) {
  if (table.querySelector("[rowspan],[colspan]")) return;
  if (table.closest(".prototype-reference,.checkpoint-answer-panel")) return;
  const headerCells = [...table.querySelectorAll<HTMLTableCellElement>("thead th")];
  const firstRow = table.rows[0];
  const headers = headerCells.length
    ? headerCells.map((cell) => normalise(cell.textContent ?? ""))
    : firstRow
      ? [...firstRow.cells].map((cell) => normalise(cell.textContent ?? ""))
      : [];
  if (!headers.length) return;

  const responseColumns = headers
    .map((header, index) => tableResponseHeader(header) ? index : -1)
    .filter((index) => index >= 0);
  if (!responseColumns.length) return;

  const bodyRows = table.tBodies.length
    ? [...table.tBodies].flatMap((body) => [...body.rows])
    : [...table.rows].slice(headerCells.length ? 0 : 1);

  bodyRows.forEach((row, rowIndex) => {
    const rowLabel = normalise(row.cells[0]?.textContent ?? "") || `Row ${rowIndex + 1}`;
    for (const columnIndex of responseColumns) {
      const cell = row.cells[columnIndex];
      if (!cell || cell.querySelector("[data-field-id],input,textarea,select")) continue;
      if (!blankWorkbookCell(cell.textContent ?? "")) continue;
      const header = headers[columnIndex] || "Your response";
      const prompt = `${rowLabel} — ${header}`;
      const multiline = /\b(?:notes?|reflection|evidence|observation|explain|why|how)\b/i.test(header);
      cell.textContent = "";
      const control = createTableResponse(
        labCode,
        pageId,
        prompt,
        `${header}|${rowLabel}|${rowIndex + 1 + Number(table.dataset.legacyHeaderRowOffset ?? 0)}|${columnIndex}`,
        multiline,
      );
      const originalId = control.dataset.fieldId!;
      if (usedFieldIds.has(originalId)) {
        const token = hashPrompt(`${originalId}|${table.dataset.informationGroup}`);
        control.dataset.fieldId = `${labCode}.WB.AUTO.TABLE.${token}`;
        control.dataset.sourceKey = `table-cell-${token.toLowerCase()}`;
      }
      usedFieldIds.add(control.dataset.fieldId!);
      cell.append(control);
    }
  });
}

function enhanceTables(root: HTMLElement, labCode: LabCode, pageId: string) {
  const usedFieldIds = new Set([...root.querySelectorAll<HTMLElement>("[data-field-id]")].map(field => field.dataset.fieldId!));
  root.querySelectorAll<HTMLTableElement>("table").forEach((table, index) => {
    const cells = Array.from(table.rows[0]?.cells ?? []);
    if (table.rows.length === 1 && cells.length === 3 &&
        normalise(cells[0].textContent ?? "") === "Prediction Accuracy = 100 −" &&
        normalise(cells[1].textContent ?? "") === "Predicted % − Actual %" &&
        !normalise(cells[2].textContent ?? "") && !table.querySelector("input,textarea,select")) {
      // The source importer interpreted the absolute-value bars as column
      // delimiters. Restore the equation used by the existing metrics engine.
      const equation = document.createElement("p");
      equation.className = "handbook-equation";
      equation.textContent = "Prediction Accuracy = 100 − |Predicted % − Actual %|";
      table.replaceWith(equation);
      return;
    }
    // Promote only a header row verified by the next row's authored labels.
    // Never infer a header from the first row of an equation or data-only table.
    const first = table.rows[0];
    const second = table.rows[1];
    if (!table.tHead && first && second && first.cells.length === second.cells.length &&
        Array.from(first.cells).every((cell, index) => cell.colSpan === 1 &&
          normalise(cell.textContent ?? "") === normalise(second.cells[index].dataset.label ?? "") &&
          Boolean(second.cells[index].dataset.label))) {
      Array.from(first.cells).forEach((cell) => {
        if (cell.tagName === "TH") return;
        const header = document.createElement("th");
        Array.from(cell.attributes).forEach((attribute) => header.setAttribute(attribute.name, attribute.value));
        header.append(...Array.from(cell.childNodes));
        cell.replaceWith(header);
      });
      table.createTHead().append(first);
      table.dataset.legacyHeaderRowOffset = "1";
    }
    const simple = !table.querySelector("[rowspan],[colspan]");
    if (simple && !table.tHead && table.rows[0]?.querySelector("th")) {
      const head = table.createTHead(); head.append(table.rows[0]);
      table.dataset.legacyHeaderRowOffset = "1";
    }
    table.dataset.informationGroup = table.dataset.informationGroup || `${pageId}.TABLE.${index + 1}`;
    const headers = [...(table.tHead?.rows[0]?.cells ?? [])].map(cell => normalise(cell.textContent ?? ""));
    if (simple && headers.length) for (const body of table.tBodies) for (const row of body.rows) {
      [...row.cells].forEach((cell, column) => { cell.dataset.label = headers[column] || ""; });
      row.dataset.informationGroup = `${table.dataset.informationGroup}.ROW.${row.sectionRowIndex + 1}`;
    }
    makeBlankLearnerTableCellsEditable(table, labCode, pageId, usedFieldIds);
    table.classList.toggle("handbook-stacked-table", simple && headers.length > 0);
    table.querySelectorAll<HTMLElement>("[data-field-id]").forEach(field => { field.dataset.responseGroup = field.closest("tr")?.dataset.informationGroup || table.dataset.informationGroup; });
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
      return entry.exact ? normal.replace(/[:_—–.\s]+$/g, "") === key : normal.startsWith(key) || normal.includes(`${key}:`);
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
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[data-field-id],textarea[data-field-id]").forEach(field => {
    if (field.dataset.purpose === "FORMAL_LAB_REFERENCE") return;
    const known = findKnownValue(field.getAttribute("aria-label") || "", context);
    if (!known?.exact) return;
    const output = document.createElement("output");
    output.className = "handbook-system-value"; output.dataset.sourceFieldId = field.dataset.fieldId;
    output.setAttribute("aria-label", field.getAttribute("aria-label") || known.labels[0]); output.textContent = known.value;
    field.replaceWith(output);
  });
  root.querySelectorAll<HTMLElement>("p,li").forEach((element) => {
    if (element.classList.contains("handbook-system-value") || element.classList.contains("handbook-profile-label") || element.querySelector("[data-field-id]")) return;
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
      /^[_\s.–—-]+$/.test(currentValue) ||
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
    const match = text.match(/^(\d+)[.)]\s*(?:(?:_{3,}|\.{3,}|[-–—]{3,}))?$/);
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


function replaceElementTag(element: HTMLElement, tagName: "h2" | "h3" | "hr") {
  const replacement = document.createElement(tagName);
  if (tagName !== "hr") {
    for (const attribute of [...element.attributes]) replacement.setAttribute(attribute.name, attribute.value);
    while (element.firstChild) replacement.append(element.firstChild);
  }
  element.replaceWith(replacement);
  return replacement;
}

function normaliseCompiledHandbookStructure(root: HTMLElement) {
  root.dataset.handbookLayout = "unified-document";

  root.querySelectorAll<HTMLElement>("p,div").forEach((element) => {
    if (element.children.length > 0 && element.tagName !== "P") return;
    const text = normalise(element.textContent ?? "");
    if (!text) return;

    if (/^(?:---|\*\*\*|___)$/.test(text)) {
      replaceElementTag(element, "hr").classList.add("handbook-section-rule");
      return;
    }

    const headingLike =
      (text.length <= 130 && /[A-Z]/.test(text) && text === text.toUpperCase() && !/[.!?]$/.test(text))
      || /^(?:how to use this book|learning levels|your 10-day map|before you begin\b|a note on\b|quick check\b|activity\s+\d+\b)/i.test(text);
    if (headingLike && !element.closest("table,.handbook-callout,.prototype-reference")) {
      replaceElementTag(element, /^DAY\s+\d+\s+OF\s+10$/i.test(text) ? "h2" : "h3");
      return;
    }

    const pipeCount = (text.match(/\|/g) ?? []).length;
    if (pipeCount >= 3 || /[┌┐└┘│─]/u.test(text)) {
      const lines = (element.innerText || element.textContent || "")
        .replace(/[┌┐└┘│─]+/gu, " ")
        .replace(/\|+/g, "\n")
        .split("\n")
        .map((line) => normalise(line))
        .filter(Boolean);
      if (lines.length) {
        element.textContent = "";
        element.classList.add("authored-lines", "handbook-callout", "handbook-source-callout");
        lines.forEach((line, index) => {
          if (index) element.append(document.createElement("br"));
          element.append(document.createTextNode(line));
        });
      }
      return;
    }

    const bullets = text.split(/\s+[•·]\s+/u).map((item) => item.trim()).filter(Boolean);
    if (bullets.length >= 3) {
      const list = document.createElement("ul");
      list.className = "handbook-restored-list";
      bullets.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.append(li);
      });
      element.replaceWith(list);
    }
  });

  const restoreLegendTable = (headingText: string, columns: 2 | 3) => {
    const heading = [...root.querySelectorAll<HTMLElement>("p,h2,h3,h4")]
      .find((element) => normalise(element.textContent ?? "").toLowerCase() === headingText.toLowerCase());
    if (!heading || heading.closest("table")) return;

    const rows: string[][] = [];
    let cursor = heading.nextElementSibling as HTMLElement | null;
    while (cursor && rows.length < 16) {
      if (cursor.matches("table,h1") || /^DAY\s+\d+\s+OF\s+10$/i.test(normalise(cursor.textContent ?? ""))) break;
      const value = normalise(cursor.textContent ?? "");
      if (!value) { cursor = cursor.nextElementSibling as HTMLElement | null; continue; }
      const match = columns === 2
        ? value.match(/^(\S+)\s+(.+)$/u)
        : value.match(/^(\S+)\s+(\S+)\s+(.+)$/u);
      if (!match || !/^(?:📖|💭|✍️|✅|🏠|📂|🔎|⚡|🔬|🎯|🧪|📊|🤝|📌|🤔|🧠|🎭|🌱|🔍|⚖️)/u.test(match[1])) break;
      rows.push(columns === 2 ? [match[1], match[2]] : [match[1], match[2], match[3]]);
      const next = cursor.nextElementSibling as HTMLElement | null;
      cursor.remove();
      cursor = next;
    }
    if (rows.length < 2) return;

    const table = document.createElement("table");
    table.className = "handbook-table handbook-restored-legend";
    const headers = columns === 2 ? ["Icon", "Meaning"] : ["Icon", "Level", "Meaning"];
    const thead = table.createTHead();
    const headRow = thead.insertRow();
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = header;
      headRow.append(th);
    });
    const tbody = table.createTBody();
    rows.forEach((row) => {
      const tr = tbody.insertRow();
      row.forEach((value, column) => {
        const td = tr.insertCell();
        td.dataset.label = headers[column];
        td.textContent = value;
      });
    });
    heading.replaceWith(table);
  };

  restoreLegendTable("Icon Meaning", 2);
  restoreLegendTable("Icon Level Meaning", 3);
}

function hideEditorialProductionMetadata(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p,div").forEach((element) => {
    if (element.querySelector("input,textarea,select,button,[data-field-id]")) return;
    if (!element.matches("p") && element.querySelector("p,div,section,table,ul,ol,h1,h2,h3,h4")) return;
    const text = normalise(element.textContent ?? "");
    if (
      // Compiled line breaks can concatenate this label with the preceding
      // edition/title in textContent. The full production phrase is explicit.
      /Controlled Production Master(?:FROZEN)?\b/i.test(text) ||
      /\bArchitecture frozen\b/i.test(text) ||
      /\bProduction-freeze revision\b/i.test(text)
    ) {
      element.classList.add("handbook-production-metadata");
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
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

function normaliseDecisionHandbookLayout(root: HTMLElement, labCode: LabCode) {
  if (labCode !== "DEC") return;

  root.dataset.handbookLayout = "decision-normalised";

  const typographyProperties = [
    "font-size",
    "line-height",
    "font-family",
    "letter-spacing",
  ];
  const rhythmProperties = [
    "margin-top",
    "margin-bottom",
  ];

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const property of typographyProperties) {
      element.style.removeProperty(property);
    }

    if (element.matches("p,h1,h2,h3,h4,li")) {
      for (const property of rhythmProperties) {
        element.style.removeProperty(property);
      }
    }

    if (element.tagName === "FONT") {
      element.removeAttribute("size");
      element.removeAttribute("face");
    }

    const text = normalise(element.textContent ?? "");
    if (!text || element.children.length > 0) return;

    if (/^(SESSION|TIME|MODE|DIFFICULTY):/i.test(text)) {
      element.classList.add("decision-handbook-meta-line");
    } else if (/^(DAY\s+\d+\s+OF\s+10|TODAY YOU WILL):?$/i.test(text)) {
      element.classList.add("decision-handbook-meta-heading");
    }
  });
}

function standardisePageHeading(root: HTMLElement) {
  const first = root.firstElementChild;
  if (!first) return;
  if (first.tagName === "H1" && /^(DAY \d+ OF 10|WEEKEND)$/i.test(normalise(first.textContent ?? "")) && first.nextElementSibling?.tagName === "H2") {
    const kicker = document.createElement("div");
    kicker.className = "day-kicker";
    kicker.append(...Array.from(first.childNodes));
    first.replaceWith(kicker);
  }
  const kicker = root.querySelector(":scope > .day-kicker");
  const title = kicker?.nextElementSibling;
  if (title && (title.tagName === "H2" || title.tagName === "P") && !title.querySelector("input,textarea,select")) {
    const heading = document.createElement("h1");
    heading.className = "page-title";
    heading.append(...Array.from(title.childNodes));
    title.replaceWith(heading);
  }
}

function softenLearnerTechnicalLabels(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p,h2,h3,h4").forEach((element) => {
    const text = normalise(element.textContent ?? "");
    if (/^Registry rules:?$/i.test(text)) element.textContent = "How BIS handles this calculation";
  });
}

function facilitatorCue(kind: string, kicker: string, title: string, body: string) {
  const cue = document.createElement("aside");
  cue.className = "facilitator-inline-cue facilitator-inline-cue-document";
  cue.dataset.facilitatorCue = kind;
  cue.setAttribute("role", "note");

  const label = document.createElement("span");
  label.textContent = kicker;
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = body;
  cue.append(label, heading, copy);
  return cue;
}

function addFacilitatorCues(root: HTMLElement, context: HandbookEnhancementContext) {
  if (!context.facilitatorMode) {
    root.removeAttribute("data-facilitator-view");
    root.querySelectorAll("[data-facilitator-cue]").forEach((cue) => cue.remove());
    return;
  }
  root.dataset.facilitatorView = "true";

  if (!root.querySelector('[data-facilitator-cue="write"]')) {
    const field = root.querySelector<HTMLElement>(".generated-question-responses, textarea.response[data-field-id], input[data-field-id], select[data-field-id]");
    const anchor = field?.closest<HTMLElement>(".generated-question-responses") ?? field;
    if (anchor?.parentElement && !anchor.closest(".checkpoint-answer-panel")) {
      anchor.insertAdjacentElement(
        "beforebegin",
        facilitatorCue(
          "write",
          "Facilitator cue · write first",
          "Give them quiet time before discussion.",
          "Let every learner write their own answer first. Do not ask anyone to read a private response aloud. When most pens stop, invite observations rather than collecting personal answers.",
        ),
      );
    }
  }

  if (!root.querySelector('[data-facilitator-cue="discuss"]')) {
    const check = root.querySelector<HTMLElement>(".handbook-concept-check-label");
    if (check?.parentElement) {
      check.insertAdjacentElement(
        "beforebegin",
        facilitatorCue(
          "discuss",
          "Facilitator cue · ask the room",
          "Ask first. Explain second.",
          context.facilitatorGuidance?.discussionMove
            ?? "Ask the question aloud, give everyone a moment to think, then invite two learners to explain what led them to their answer before you add anything.",
        ),
      );
    }
  }
}

function restoreUnpairedProfileTables(root: HTMLElement) {
  for (const header of root.querySelectorAll<HTMLElement>("p")) {
    if (header.dataset.profileTableHeader === "true" || normalise(header.textContent ?? "") !== "Element My Answer") continue;
    const rows: HTMLElement[] = [];
    let next = header.nextElementSibling;
    while (next?.tagName === "P") {
      if (!normalise(next.textContent ?? "") || next.querySelector("input,textarea,select,button,[data-field-id]")) break;
      rows.push(next as HTMLElement);
      next = next.nextElementSibling;
    }
    // Recover only the explicit authored two-column profile header and its
    // uninterrupted passive rows. Existing answer controls are never moved.
    if (rows.length < 2) continue;
    const title = learnerHeadingText(header.previousElementSibling?.textContent ?? "Investigation profile");
    const table = document.createElement("table");
    table.className = "handbook-profile-table";
    table.setAttribute("aria-label", title);
    table.createCaption().textContent = "A dash means the value is not available in this view.";
    const headingRow = table.createTHead().insertRow();
    for (const label of ["Element", "My Answer"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headingRow.append(cell);
    }
    const body = table.createTBody();
    for (const original of rows) {
      const row = body.insertRow();
      const label = document.createElement("th");
      label.scope = "row";
      label.dataset.label = "Element";
      const answer = row.insertCell();
      answer.dataset.label = "My Answer";
      const known = original.classList.contains("handbook-system-value") ? original.querySelector(":scope > strong") : null;
      if (known) {
        // Reuse only a value already resolved by the existing Lab binding code.
        // This is neither an additional calculation nor an editable score.
        answer.append(known);
        const source = original.querySelector(":scope > small");
        if (source) answer.append(source);
        answer.dataset.systemValue = "true";
        answer.className = "handbook-table-system-value";
        original.classList.remove("handbook-system-value");
      } else {
        const unavailable = document.createElement("span");
        unavailable.textContent = "—";
        unavailable.setAttribute("aria-label", "Not available in this view");
        answer.append(unavailable);
      }
      original.classList.add("handbook-profile-label");
      label.append(original);
      row.prepend(label);
    }
    const wrapper = document.createElement("div");
    wrapper.className = "handbook-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", `${title} — profile table`);
    wrapper.append(table);
    header.dataset.profileTableHeader = "true";
    header.hidden = true;
    header.setAttribute("aria-hidden", "true");
    header.after(wrapper);
  }
}

function restoreParagraphBulletLists(root: HTMLElement) {
  for (const first of root.querySelectorAll<HTMLElement>("p.source-item")) {
    if (!first.isConnected || first.closest("li") || !/^\s*•\s+/.test(first.textContent ?? "")) continue;
    const rows: HTMLElement[] = [];
    let cursor: Element | null = first;
    while (cursor?.matches("p.source-item") && /^\s*•\s+/.test(cursor.textContent ?? "") && !cursor.querySelector("input,textarea,select,button,[data-field-id]")) {
      rows.push(cursor as HTMLElement); cursor = cursor.nextElementSibling;
    }
    if (rows.length < 2) continue;
    const list = document.createElement("ul");
    list.className = "source-list handbook-restored-list";
    first.before(list);
    for (const paragraph of rows) {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode() as Text | null;
      const marker = /^\s*•\s+/.exec(text?.data ?? "");
      if (text && marker) {
        const remainder = text.splitText(marker[0].length);
        const original = document.createElement("span");
        original.className = "handbook-print-bullet";
        original.hidden = true; original.setAttribute("aria-hidden", "true");
        remainder.before(original); original.append(text);
      }
      const item = document.createElement("li"); item.append(paragraph); list.append(item);
    }
  }
  // Existing native source lists share the same markers. Interactive option
  // lists keep their controls and established presentation.
  root.querySelectorAll<HTMLElement>("ul,ol").forEach(list => {
    if (!list.querySelector("input,textarea,select,button,[data-field-id]") && !list.getAttribute("role")) list.classList.add("handbook-authored-list");
  });
}

function discloseWeekendContext(root: HTMLElement, pageId: string) {
  if (!pageId.endsWith(".WEEKEND") || root.querySelector(".handbook-weekend-details")) return;
  const combined = [...root.querySelectorAll<HTMLElement>("ul.handbook-restored-list>li:first-child")]
    .find(item => /^NO SESSION\s+EXPERIMENT POSITION:\s*.+\s+WHAT YOU DO:$/i.test(normalise(item.textContent ?? "")) && !item.querySelector("input,textarea,select,button,[data-field-id]"));
  const separate = [...root.querySelectorAll<HTMLElement>("p,h3")].find(item => /^NO SESSION$/i.test(normalise(item.textContent ?? "")));
  const position = separate?.nextElementSibling as HTMLElement | null;
  const actionHeading = position?.nextElementSibling as HTMLElement | null;
  const separatePosition = /^EXPERIMENT POSITION:\s*(.+)$/i.exec(normalise(position?.textContent ?? ""));
  if (!combined && (!separate || !separatePosition || !/^WHAT YOU DO:$/i.test(normalise(actionHeading?.textContent ?? ""))
    || [separate, position, actionHeading].some(item => item?.querySelector("input,textarea,select,button,[data-field-id]")))) return;
  const details = document.createElement("details");
  details.className = "learner-document-disclosure handbook-weekend-details";
  const summary = document.createElement("summary"); summary.textContent = "Experiment details";
  const session = document.createElement("p"); session.textContent = "No session";
  const days = document.createElement("p");
  days.textContent = combined ? /^NO SESSION\s+EXPERIMENT POSITION:\s*(.+?)\s+WHAT YOU DO:$/i.exec(normalise(combined.textContent ?? ""))![1] : separatePosition![1];
  details.append(summary, session, days);
  if (combined) {
    const list = combined.parentElement!; list.before(details);
    list.classList.add("source-list");
    const heading = document.createElement("h3"); heading.textContent = "What to do"; list.before(heading);
    combined.classList.add("handbook-print-context"); combined.hidden = true; combined.setAttribute("aria-hidden", "true");
  } else {
    separate!.before(details);
    for (const original of [separate!, position!]) {
      original.classList.add("handbook-print-context"); original.hidden = true; original.setAttribute("aria-hidden", "true");
    }
    actionHeading!.textContent = "What to do";
  }
}

function finishHandbookPresentation(root: HTMLElement, context: HandbookEnhancementContext, pageId: string) {
  restoreUnpairedProfileTables(root);
  restoreParagraphBulletLists(root);
  discloseWeekendContext(root, pageId);
  // Printed cover matter belongs behind the reading canvas. Keep the original
  // nodes and publisher trace; only internal production notes leave the display.
  const welcome = [...root.querySelectorAll<HTMLElement>("h1,h2")]
    .find(heading => normalise(heading.textContent ?? "").toUpperCase() === "WELCOME");
  if (welcome && !root.querySelector(".handbook-publication-details")) {
    const cover = document.createRange();
    cover.setStart(root, 0);
    cover.setEndBefore(welcome);
    const specimen = cover.cloneContents();
    if (/\bLAB™/.test(specimen.textContent ?? "")
      && !specimen.querySelector("input,textarea,select,button")) {
      const details = document.createElement("details");
      details.className = "learner-document-disclosure handbook-publication-details";
      const summary = document.createElement("summary");
      summary.textContent = "About this handbook";
      details.append(summary, cover.extractContents());
      welcome.before(details);
      details.querySelectorAll<HTMLElement>("p,div").forEach(row => {
        const text = normalise(row.textContent ?? "");
        if (!/^Version\b/i.test(text) || !/Controlled Production Master|Architecture frozen|Production.freeze/i.test(text)) return;
        if ([...row.querySelectorAll("p,div")].some(child => /^Version\b/i.test(normalise(child.textContent ?? ""))
          && /Controlled Production Master|Architecture frozen|Production.freeze/i.test(child.textContent ?? ""))) return;
        const version = document.createElement("p");
        version.textContent = text.split(/Controlled Production Master|Architecture frozen|Production.freeze/i)[0].replace(/[|\s]+$/, "").trim();
        row.before(version);
        row.classList.add("handbook-production-note");
        row.hidden = true;
        row.setAttribute("aria-hidden", "true");
      });
    }
  }

  // The publication header already supplies the day and title. Keep the source
  // elements intact so this never changes the text used for response identities.
  const titleKey = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  if (context.pageTitle) {
    for (const heading of [...root.querySelectorAll<HTMLElement>("h1,h2,.day-kicker")].slice(0, 3)) {
      const value = normalise(heading.textContent ?? "");
      if (titleKey(value) === titleKey(context.pageTitle)
        || (context.programmeDay && value === `DAY ${context.programmeDay} OF 10`)
        || (pageId.endsWith(".WEEKEND") && /^(?:WEEKEND|Field Experiment)$/i.test(value))
        || (pageId.endsWith(".CERTIFICATE") && /^CERTIFICATE$/i.test(value))) {
        heading.classList.add("handbook-repeated-heading");
        heading.hidden = true;
      }
    }
  }

  // Printed line wrapping sometimes attaches the next section label to the
  // final checklist item or resource. Separate it after checklist construction
  // so its existing storage key and checked state stay intact.
  root.querySelectorAll<HTMLElement>(".handbook-check-row>span,.handbook-check-context").forEach((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const match = /\b(YOU WILL NEED:|EXPERIMENT POSITION:)/i.exec(node.textContent ?? "");
      if (match && match.index > 0) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(element, element.childNodes.length);
        const contextLine = document.createElement(match[1].toUpperCase() === "YOU WILL NEED:" ? "h3" : "p");
        contextLine.className = "handbook-session-context";
        contextLine.append(range.extractContents());
        const checklist = element.closest(".handbook-choice-list");
        const anchor = checklist?.parentElement?.matches("p")
          ? checklist.parentElement
          : element.closest(".handbook-check-row") ?? element;
        anchor.after(contextLine);
        const choice = element.closest(".handbook-check-row")?.querySelector("input");
        if (choice) choice.setAttribute("aria-label", normalise(element.textContent ?? ""));
        break;
      }
      node = walker.nextNode();
    }
  });

  const rows: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>("p,div,span,h3").forEach((element) => {
    if (element.closest(".handbook-session-details,table")
      || element.querySelector("input,textarea,select,button,details")) return;
    const value = normalise(element.textContent ?? "");
    if (!/^(SESSION|TIME|MODE|DIFFICULTY):/i.test(value)) return;
    // Choose the outer row, preserving rich text inside it.
    if (element.parentElement !== root
      && /^(SESSION|TIME|MODE|DIFFICULTY):/i.test(normalise(element.parentElement?.textContent ?? ""))
      && !element.parentElement?.querySelector("input,textarea,select,button")) return;

    if (/TODAY YOU WILL:/i.test(value)) {
      // Some source editions combine passive labels with the objectives in one
      // printable paragraph. Split only the passive prefix; objectives stay open.
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const match = /TODAY YOU WILL:/i.exec(node.textContent ?? "");
        if (match) {
          const range = document.createRange();
          range.setStart(element, 0);
          range.setEnd(node, match.index);
          const row = document.createElement("div");
          row.append(range.extractContents());
          element.before(row);
          rows.push(row);
          break;
        }
        node = walker.nextNode();
      }
    } else {
      rows.push(element);
    }
  });
  for (const row of rows) {
    if (!row.parentElement || row.closest(".handbook-session-details")) continue;
    // A standalone duration can be an important Lab handover, not secondary
    // session metadata. Fold only a session block with additional labels.
    const text = normalise(row.textContent ?? "");
    if (!/^SESSION:/i.test(text)
      || (!/\b(TIME|MODE|DIFFICULTY):/i.test(text)
        && !rows.includes(row.nextElementSibling as HTMLElement))) continue;
    const details = document.createElement("details");
    details.className = "learner-document-disclosure handbook-session-details";
    const summary = document.createElement("summary");
    summary.textContent = context.programmeDay === 3 ? "Lab session details" : "Session details";
    row.before(details);
    details.append(summary, row);
    // Only adjacent passive rows belong together; never collapse a task.
    while (details.nextElementSibling && rows.includes(details.nextElementSibling as HTMLElement)) {
      details.append(details.nextElementSibling);
    }
    if (context.programmeDay === 3) {
      const duration = /TIME:\s*(\d+\s*minutes)/i.exec(normalise(details.textContent ?? ""))?.[1];
      if (duration) summary.textContent += ` · ${duration}`;
    }
  }

  root.querySelectorAll<HTMLElement>("h1,h2,h3,h4").forEach((heading) => {
    if (heading.querySelector(".handbook-heading-decoration,input,textarea,select")) return;
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode() as Text | null;
    if (!node) return;
    const raw = node.data;
    const leading = raw.length - raw.trimStart().length;
    // The checkpoint title names an activity, not a verified outcome. Preserve
    // checkmarks everywhere else, including answer choices and evidence status.
    const cleaned = /^✅\s*(?:Final\s+)?Checkpoint\b/i.test(raw.trimStart())
      ? raw.trimStart().replace(/^✅\s*/u, "") : learnerHeadingText(raw.trimStart());
    const length = raw.trimStart().length - cleaned.length;
    if (!length) return;
    const start = node.splitText(leading);
    start.splitText(length);
    const decoration = document.createElement("span");
    decoration.className = "handbook-heading-decoration";
    decoration.hidden = true;
    decoration.setAttribute("aria-hidden", "true");
    start.before(decoration);
    decoration.append(start);
  });

  // The shared publication header supplies the page's only top-level heading.
  // Source formatting can mark several workbook sections as h1; retain their
  // text, attributes and controls while giving them section semantics.
  if (context.pageTitle) root.querySelectorAll("h1").forEach(heading => {
    const section = document.createElement("h2");
    for (const attribute of heading.attributes) section.setAttribute(attribute.name, attribute.value);
    section.setAttribute("data-source-heading-level", "1");
    section.append(...heading.childNodes);
    heading.replaceWith(section);
  });
}

export function enhanceHandbookDocument(
  root: HTMLElement,
  labCode: LabCode,
  pageId: string,
  context: HandbookEnhancementContext = {},
) {
  if (!context.referenceOnly && context.programmeDay && context.programmeDay !== 3) {
    root.querySelectorAll<HTMLElement>("p,div,span").forEach((element) => {
      if (!/^TIME:\s*90\s*minutes\.?$/i.test(normalise(element.textContent ?? ""))) return;
      const parent = element.parentElement;
      if (parent && parent !== root && parent.matches("p,div,span")
        && /^TIME:\s*90\s*minutes\.?$/i.test(normalise(parent.textContent ?? ""))) return;
      element.dataset.sourceTiming = "90 minutes";
      element.textContent = `TIME: ${BIS_LEARNING_SESSION_MINUTES} minutes`;
    });
  }
  normaliseCompiledHandbookStructure(root);
  standardisePageHeading(root);
  removeInstructionResponseControls(root);
  cleanOrphanedResponseControls(root);
  labelAuthoredResponses(root);
  removeUnboundGenericResponses(root);
  upgradePrintableCheckboxes(root, pageId);
  applyKnownValues(root, context);
  applyKnownTableValues(root, context);
  enhanceTables(root, labCode, pageId);
  replacePaperIdentityFields(root, context, labCode, pageId);
  hardenReferenceOnlyLabContent(root, context);
  convertSimplePaperBlanks(root, labCode, pageId);
  convertNumberedPaperBlanks(root, labCode, pageId);
  convertPriorityWorksheetRows(root, labCode, pageId);
  hideEditorialProductionMetadata(root);
  normaliseDecisionHandbookLayout(root, labCode);
  softenLearnerTechnicalLabels(root);
  applyEditionLearnerLanguage(root, context);
  collapseSuggestedAnswers(root);
  if (!context.referenceOnly && context.enableFormativeLearningChecks) {
    addInterleavedConceptChecks(root, labCode, pageId, context);
  }
  addMissingCheckpointResponses(root, labCode, pageId);
  structureAuthoredResponses(root);
  addFacilitatorCues(root, context);
  finishHandbookPresentation(root, context, pageId);
  if (!learningCheckListeners.has(root)) {
    root.addEventListener("input", () => syncHandbookLearningChecks(root));
    root.addEventListener("change", () => syncHandbookLearningChecks(root));
    learningCheckListeners.add(root);
  }
  syncHandbookLearningChecks(root);
}
