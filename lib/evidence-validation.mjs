/** The pilot uses the same local calendar for reminders and evidence gates. */
export function todayInZone(now = new Date(), timeZone = "Africa/Johannesburg") {
  if (typeof now === "string" && !/^\d{4}-\d{2}-\d{2}/.test(now)) {
    timeZone = now;
    now = new Date();
  }
  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("A valid date is required to calculate the local experiment day.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Reject normalized dates such as February 31, not just malformed strings. */
export function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Missing, passed and malformed ratings are not zero-valued observations. */
export function ratingShift(before, after) {
  const valid = (value) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
  return valid(before) && valid(after) ? after - before : null;
}

/**
 * Preserve canonical evidence values when an older/stale learner surface submits
 * a human-readable equivalent of a typed control. This is deliberately narrow:
 * it only normalizes unambiguous Boolean and South African display-date values.
 */
export function normalizePromptResponseValue(prompt, value) {
  if (prompt?.type === "INTEGER" && typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (typeof value !== "string") return value;
  const trimmed = value.trim();

  if (prompt?.type === "BOOLEAN") {
    const plain = trimmed
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ");
    if (/^(?:yes|y|true|✓)(?:\b|$)/u.test(plain) || /^i did(?:\b|$)/u.test(plain)) return "Yes";
    if (/^(?:no|n|false|✗|x)(?:\b|$)/u.test(plain) || /^i did not(?:\b|$)/u.test(plain)) return "No";
  }

  if (prompt?.type === "DATE") {
    const local = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (local) {
      const [, day, month, year] = local;
      const iso = `${year}-${month}-${day}`;
      if (isIsoDate(iso)) return iso;
    }
  }

  return value;
}

/** Dynamic Lab controls submit strings; validate their authored types and ranges. */
export function validPromptResponse(prompt, value, status = "ANSWERED") {
  if (status === "PASS") return true;
  if (status !== "ANSWERED" || typeof value !== "string" || value.length > 20000) return false;
  if (!value.trim()) return prompt.required === false;
  switch (prompt.type ?? "TEXT") {
    case "INTEGER": {
      const number = Number(value);
      return /^-?\d+$/.test(value.trim()) && Number.isSafeInteger(number) &&
        (prompt.min === undefined || number >= prompt.min) &&
        (prompt.max === undefined || number <= prompt.max);
    }
    case "BOOLEAN": return value === "Yes" || value === "No";
    case "DATE": return isIsoDate(value);
    case "CATEGORICAL": return (prompt.options ?? []).includes(value);
    case "MULTI_SELECT": {
      let values;
      try { values = JSON.parse(value); } catch { return false; }
      return Array.isArray(values) && (prompt.required === false || values.length > 0) &&
        values.every((item) => typeof item === "string" && (prompt.options ?? []).includes(item)) &&
        new Set(values).size === values.length;
    }
    default: return true;
  }
}
