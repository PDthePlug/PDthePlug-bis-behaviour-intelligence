/** A controlled clock for dedicated synthetic accounts on a local staging server.
 * Production builds and every ordinary principal always use the real clock.
 * There is no client/request-header override.
 */
export function labClockInstant(principalEmail, environment = process.env, actualNow = new Date()) {
  const configured = environment.BIS_STAGING_CERTIFICATION_CLOCK_ISO;
  if (!configured || environment.NODE_ENV !== "development"
    || environment.NEXT_PUBLIC_SUPABASE_URL !== "https://lbmhkddrkhtmkcvfmumd.supabase.co"
    || !/^fullscope-\d{8}-(?:\d{2}|learner-\d{2})@bis-staging\.example\.invalid$/i.test(principalEmail ?? "")) return actualNow;
  const clock = new Date(configured);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(configured) || !Number.isFinite(clock.getTime())
    || clock.toISOString().replace(".000Z", "Z") !== configured.replace(".000Z", "Z")) throw new Error("The staging certification clock must be a valid ISO instant.");
  return clock;
}
