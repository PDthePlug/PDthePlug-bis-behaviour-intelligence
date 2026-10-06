// Presentation only: response keys, source wording and measure definitions use
// the original content. Keep meaningful checkmarks, scales and stage numbers.
const decoration = /^(?:📖|💭|🤔|⏸️?|🔍|🔎|✍️?|⚖️?|🤝|📊|🌱|⭐|👁️?|🧠|🎯|⚡|📂|🏠|📌)\s*/u;

export function learnerHeadingText(value) {
  return String(value ?? "").replace(decoration, "");
}

export function learnerHeadingHtml(html) {
  return String(html ?? "").replace(
    /(<h[1-6]\b[^>]*>(?:\s*<(?:strong|b|span)\b[^>]*>)?\s*)([^<]*)/gi,
    (_match, opening, text) => opening + learnerHeadingText(text),
  );
}
