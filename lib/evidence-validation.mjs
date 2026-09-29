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
