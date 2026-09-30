/** The pilot uses the same local calendar for reminders and evidence gates. */
export function todayInZone(now = new Date(), timeZone = "Africa/Johannesburg") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
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
