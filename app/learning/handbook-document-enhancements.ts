type LabCode = "HAB" | "DEC" | "MON" | "IDN" | "ATT";

const normalise = (value: string) => value.replace(/\s+/g, " ").trim();

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
  return /^(answers?|suggested answers?)\s*:?s*$/i.test(normalise(element.textContent ?? ""));
}

function isSectionBoundary(element: Element) {
  if (/^(H1|H2|H3|HR)$/.test(element.tagName)) return true;
  if (element.classList.contains("prototype-lab-handoff")) return true;
  return /^✅?\s*checkpoint\b/i.test(normalise(element.textContent ?? ""));
}

function collapseSuggestedAnswers(root: HTMLElement) {
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
    const summary = document.createElement("summary");
    summary.innerHTML =
      '<span class="checkpoint-answer-label closed">Show suggested answers</span>' +
      '<span class="checkpoint-answer-label open">Hide suggested answers</span>';
    const body = document.createElement("div");
    body.className = "checkpoint-answer-body";

    parent.insertBefore(details, heading);
    details.append(summary, body);
    heading.remove();
    for (const node of following) body.append(node);
  }
}

function hasExistingAnswerSpace(element: HTMLElement) {
  if (element.querySelector("textarea[data-field-id]")) return true;
  let cursor = element.nextElementSibling;
  let inspected = 0;
  while (cursor && inspected < 2) {
    if (cursor.matches("textarea[data-field-id]") || cursor.querySelector("textarea[data-field-id]")) {
      return true;
    }
    if (cursor.matches("h1,h2,h3,hr") || questionPrompts(cursor as HTMLElement).length) break;
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

function addMissingQuestionResponses(root: HTMLElement, labCode: LabCode, pageId: string) {
  const candidates = [...root.querySelectorAll<HTMLElement>("p,li,.authored-lines,.handbook-callout")];
  const occurrences = new Map<string, number>();

  for (const element of candidates) {
    if (
      element.closest(".checkpoint-answer-panel") ||
      element.closest(".prototype-reference") ||
      element.closest(".prototype-lab-handoff") ||
      element.closest("summary") ||
      element.closest("textarea")
    ) {
      continue;
    }

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

    element.insertAdjacentElement("afterend", responseGroup);
  }
}

export function enhanceHandbookDocument(root: HTMLElement, labCode: LabCode, pageId: string) {
  collapseSuggestedAnswers(root);
  addMissingQuestionResponses(root, labCode, pageId);
}
