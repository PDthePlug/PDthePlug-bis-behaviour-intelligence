export const BIS_PRODUCTION_ORIGIN = "https://bis-behaviour-intelligence.vercel.app";

export function confirmationRedirectUrl(next: string, runtimeOrigin: string) {
  const origin = /^https?:\/\/localhost(?::\d+)?$/i.test(runtimeOrigin)
    ? runtimeOrigin
    : BIS_PRODUCTION_ORIGIN;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
