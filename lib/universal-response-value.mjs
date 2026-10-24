/** Exact value-family key; question wording is never used to create additional fields. */
export function authoredValueKey(label) {
  return String(label).replace(/^your answer:\s*/i, "").replace(/^(?:my|your)\s+/i, "")
    .replace(/[:_\s.]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
