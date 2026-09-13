const BIS_PRODUCTION_SUPABASE_URL = "https://swmhsqivqaqwovojbceo.supabase.co";
const BIS_PRODUCTION_PUBLISHABLE_KEY = "sb_publishable_IczP7dez0-Ac_XsNz1nZMw_a8PlZLGE";

export function supabaseBrowserConfig() {
  const overrideUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const overrideKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (Boolean(overrideUrl) !== Boolean(overrideKey)) {
    throw new Error(
      "BIS Supabase overrides must provide both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    url: overrideUrl || BIS_PRODUCTION_SUPABASE_URL,
    publishableKey: overrideKey || BIS_PRODUCTION_PUBLISHABLE_KEY,
  };
}
