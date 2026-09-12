const BIS_PRODUCTION_SUPABASE_URL = "https://swmhsqivqaqwovojbceo.supabase.co";
const BIS_PRODUCTION_PUBLISHABLE_KEY = "sb_publishable_IczP7dez0-Ac_XsNz1nZMw_a8PlZLGE";

export function supabaseBrowserConfig() {
  // Environment variables remain the preferred override for local, branch or future
  // environments. The fallback uses only the canonical BIS Production public endpoint
  // and Supabase publishable browser key; authorization remains enforced by RLS.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || BIS_PRODUCTION_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || BIS_PRODUCTION_PUBLISHABLE_KEY;

  return { url, publishableKey };
}
