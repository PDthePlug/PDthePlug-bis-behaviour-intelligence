export const BIS_PRODUCTION_ORIGIN = "https://www.bisportal.online";

// The hosting alias is deliberately not an application origin. Only local
// development may return to a different origin.
export function applicationOrigin(runtimeOrigin: string) {
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

export function confirmationRedirectUrl(next: string, runtimeOrigin: string) {
  const origin = applicationOrigin(runtimeOrigin);
  return `${origin}/auth/callback?next=${encodeURIComponent(safeReturnPath(next))}`;
}

export function recoveryRedirectUrl(runtimeOrigin: string) {
  return confirmationRedirectUrl("/reset-password", runtimeOrigin);
}
