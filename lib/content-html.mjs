import sanitizeHtml from "sanitize-html";

/** Preserve authored prose and bound workbook controls, never executable content. */
export function sanitizeContentHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "input", "textarea", "select", "option", "label", "details", "summary"],
    allowedAttributes: {
      "*": ["class", "id", "title", "role", "aria-*", "data-*", "lang", "dir"],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height", "loading"],
      input: [{ name: "type", values: ["text", "number", "date", "range", "checkbox", "radio"] }, "value", "min", "max", "step", "maxlength", "placeholder", "checked", "disabled", "readonly", "required"],
      textarea: ["rows", "cols", "maxlength", "placeholder", "disabled", "readonly", "required"],
      select: ["multiple", "disabled", "required"],
      option: ["value", "selected", "disabled"],
      label: ["for"],
      td: ["colspan", "rowspan", "headers"],
      th: ["colspan", "rowspan", "scope", "headers"],
      details: ["open"],
      ol: ["start", "reversed", "type"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
  });
}

/** Also protect previously compiled dynamic packages on their way to a reader. */
export function sanitizeRuntimePackage(payload) {
  if (!payload || typeof payload !== "object") return payload;
  for (const page of payload.treatment?.pages ?? payload.pages ?? []) {
    if (typeof page?.html === "string") page.html = sanitizeContentHtml(page.html);
  }
  for (const investigation of payload.investigations ?? []) {
    if (typeof investigation?.introHtml === "string") investigation.introHtml = sanitizeContentHtml(investigation.introHtml);
    for (const block of investigation.blocks ?? []) {
      if (block.type === "HTML" && typeof block.html === "string") block.html = sanitizeContentHtml(block.html);
    }
  }
  return payload;
}
