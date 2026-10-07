export const BIS_PRODUCTION_ORIGIN = "https://www.bisportal.online";

// Production always returns to the canonical application. Staging may return
// only to a preview origin explicitly bound by its deployment, or localhost.
export function applicationOrigin(runtimeOrigin: string) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL === "https://lbmhkddrkhtmkcvfmumd.supabase.co" &&
      [process.env.NEXT_PUBLIC_BIS_PREVIEW_ORIGIN, process.env.NEXT_PUBLIC_BIS_PREVIEW_BRANCH_ORIGIN].some(origin =>
        Boolean(origin) && origin === runtimeOrigin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin!))) {
    return runtimeOrigin;
  }
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(runtimeOrigin)
    ? runtimeOrigin
    : BIS_PRODUCTION_ORIGIN;
}

export function safeReturnPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return "/";
    const url = new URL(value, BIS_PRODUCTION_ORIGIN);
    if (url.origin !== BIS_PRODUCTION_ORIGIN) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function optionalSafeReturnPath(value: string | null | undefined) {
  if (!value) return undefined;
  const safe = safeReturnPath(value);
  return safe === "/" && value !== "/" ? undefined : safe;
}

export function confirmationRedirectUrl(next: string, runtimeOrigin: string) {
  const origin = applicationOrigin(runtimeOrigin);
  return `${origin}/auth/callback?next=${encodeURIComponent(safeReturnPath(next))}`;
}

export function recoveryRedirectUrl(runtimeOrigin: string) {
  return confirmationRedirectUrl("/reset-password", runtimeOrigin);
}
