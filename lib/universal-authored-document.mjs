import { authoredValueKey } from "./universal-response-value.mjs";
import sanitizeHtml from "sanitize-html";
import { sanitizeContentHtml } from "./content-html.mjs";
import { learnerHeadingHtml } from "./learner-heading-presentation.mjs";

export const UNIVERSAL_DOCUMENT_VERSION = "universal-authored-document-1";

function attributes(markup, expectedTag) {
  let result = {};
  sanitizeHtml(markup, {
    allowedTags: [expectedTag],
    transformTags: { [expectedTag]: (tagName, attribs) => {
      result = attribs;
      return { tagName, attribs };
    } },
  });
  return result;
}

/** Compile declared answer locations once. Prose and question marks are never inputs. */
export function compileUniversalAuthoredDocument(sourceHtml, { pageKey, pageTitle } = {}) {
  if (/\bdata-universal-response-slot\s*=/i.test(sourceHtml)) throw new Error("Answer slots are reserved for the Universal compiler.");
  const fields = [];
  const ids = new Set();
  const html = sanitizeContentHtml(sourceHtml).replace(
    /<(textarea|select)\b[^>]*>[\s\S]*?<\/\1>|<input\b[^>]*>/gi,
    markup => {
      const tag = markup.match(/^<(\w+)/)[1].toLowerCase();
      const attrs = attributes(markup, tag);
      const id = attrs["data-field-id"];
      const sourceKey = attrs["data-source-key"];
      const label = attrs["aria-label"];
      if (!id || !sourceKey || !label) throw new Error("Every authored response needs a stable ID, source location and accessible label.");
      if (ids.has(id)) throw new Error(`Duplicate authored response location: ${id}.`);
      ids.add(id);
      const options = tag === "select" ? [...markup.matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)]
        .map(([option]) => attributes(option, "option").value).filter(value => value !== "" && value !== undefined) : undefined;
      if (options && (!options.length || new Set(options).size !== options.length)) throw new Error(`Authored choices must have distinct non-empty values: ${id}.`);
      const inputType = attrs.type || "text";
      if (tag === "input" && !["text", "date", "number", "checkbox", "radio", "range"].includes(inputType)) throw new Error("Unsupported authored response control.");
      fields.push({
        id, sourceKey, label, prompt: label, valueKey: authoredValueKey(label),
        type: tag === "select" ? "CATEGORICAL" : inputType === "date" ? "DATE" : ["number", "range"].includes(inputType) ? "INTEGER" : inputType === "checkbox" ? "BOOLEAN" : "TEXT",
        control: tag === "textarea" ? "PARAGRAPH" : inputType === "checkbox" ? "CHECKBOX" : inputType === "radio" ? "RADIO" : "LINE",
        ...(options ? { options } : {}),
        ...(attrs.min !== undefined ? { min: Number(attrs.min) } : {}),
        ...(attrs.max !== undefined ? { max: Number(attrs.max) } : {}),
        ...(attrs.value ? { choiceValue: attrs.value } : {}),
        ...(attrs.placeholder ? { placeholder: attrs.placeholder } : {}),
        rows: Math.max(1, Math.min(12, Number(attrs.rows) || 4)),
        purpose: attrs["data-purpose"] || "LEARNING_RESPONSE",
        privacyClass: attrs["data-privacy-class"] || "P3",
        readOnly: Object.hasOwn(attrs, "readonly") || Object.hasOwn(attrs, "disabled"),
      });
      // Attribute values were sanitized, and the only new interpolation is an escaped ID.
      return `<span class="universal-authored-slot" data-universal-response-slot="${id.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></span>`;
    },
  );
  // Keep relational tables together, with scrolling local to the table on narrow screens.
  const titleKey = value => String(value ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const presentedHeadings = learnerHeadingHtml(html).replace(/<(h[12])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_whole, tag, attrs, text) => {
    const repeated = [pageKey, pageTitle, /^Day \d+$/.test(pageKey ?? "") ? `${pageKey} of 10` : null].filter(Boolean).some(title => titleKey(title) === titleKey(text));
    return `<h2${attrs}${repeated ? ' hidden aria-hidden="true"' : ""}>${text}</h2>`;
  });
  const welcome = pageKey === "Welcome" ? /<h2\b[^>]*>\s*WELCOME\s*<\/h2>/i.exec(presentedHeadings) : null;
  const cover = welcome ? presentedHeadings.slice(0, welcome.index) : "";
  const reading = cover.includes("LAB™") && !cover.includes("data-universal-response-slot")
    ? '<details class="learner-document-disclosure handbook-publication-details"><summary>About this handbook</summary>' + cover + '</details>' + presentedHeadings.slice(welcome.index)
    : presentedHeadings;
  const presented = reading.replace(/<table\b/g, '<div class="handbook-table-scroll" tabindex="0" role="region" aria-label="Workbook table"><table')
    .replace(/<\/table>/g, "</table></div>");
  return { schemaVersion: UNIVERSAL_DOCUMENT_VERSION, html: presented, fields };
}
