const BIS_PRODUCTION_SUPABASE_HOST = "swmhsqivqaqwovojbceo.supabase.co";

function isProductionProject(url: string) {
  try {
    return new URL(url).hostname.toLowerCase() === BIS_PRODUCTION_SUPABASE_HOST;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.");
  }
}

export function supabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "BIS backend configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for this environment.",
    );
  }

  if (isProductionProject(url) && process.env.NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE !== "true") {
    throw new Error(
      "Refusing to use the BIS Production Supabase project without NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE=true. This override belongs only in the production deployment environment.",
    );
  }

  return { url, publishableKey };
}
