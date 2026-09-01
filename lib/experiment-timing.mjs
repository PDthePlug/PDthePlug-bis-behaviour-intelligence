const DAY_MS = 86_400_000;

function utcDay(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isoFromUtcDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Derive the learner-facing state of an opportunity-based experiment.
 * Future days never unlock, and the window cannot close until the final
 * calendar day has been recorded or has fully elapsed.
 *
 * @param {{startDate: string, plannedEndDate: string, status: string}} experiment
 * @param {Array<{dayNumber: number}>} events
 * @param {string} [todayIso]
 */
export function getExperimentTiming(experiment, events, todayIso = new Date().toISOString().slice(0, 10)) {
  const startDay = utcDay(experiment.startDate);
  const endDay = utcDay(experiment.plannedEndDate);
  const todayDay = utcDay(todayIso);
  const totalDays = Math.max(1, Math.min(21, Math.floor((endDay - startDay) / DAY_MS) + 1));
  const elapsed = Math.floor((todayDay - startDay) / DAY_MS) + 1;
  const availableDay = elapsed < 1 ? 0 : Math.min(totalDays, elapsed);
  const recordedDays = new Set(events.map((event) => event.dayNumber));
  const missingAvailableDay = Array.from({ length: availableDay }, (_, index) => index + 1)
    .find((day) => !recordedDays.has(day)) ?? null;
  const calendarDay = elapsed >= 1 && elapsed <= totalDays ? elapsed : null;
  const todayRecorded = calendarDay !== null && recordedDays.has(calendarDay);
  const active = experiment.status === "ACTIVE";

  let status;
  if (!active) status = "CLOSED";
  else if (elapsed < 1) status = "BEFORE_START";
  else if (elapsed > totalDays) status = "WINDOW_COMPLETE";
  else if (todayRecorded && elapsed === totalDays) status = "WINDOW_COMPLETE";
  else if (todayRecorded) status = missingAvailableDay ? "CATCH_UP_AVAILABLE" : "WAITING_NEXT_DAY";
  else status = "READY_TODAY";

  const suggestedDay = calendarDay && !todayRecorded
    ? calendarDay
    : missingAvailableDay ?? calendarDay ?? Math.max(1, availableDay);
  const nextUnlockDate = status === "WAITING_NEXT_DAY" || status === "CATCH_UP_AVAILABLE"
    ? isoFromUtcDay(todayDay + DAY_MS)
    : null;
  const canClose = active && (elapsed > totalDays || (elapsed === totalDays && todayRecorded));

  return {
    status,
    totalDays,
    elapsed,
    availableDay,
    calendarDay,
    todayRecorded,
    missingAvailableDay,
    suggestedDay,
    nextUnlockDate,
    canClose,
  };
}
