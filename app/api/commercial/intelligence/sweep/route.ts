import { createClient } from "@supabase/supabase-js";
import { AccessError } from "@/lib/bis-access";
import { handleCommercialSchedule } from "@/lib/commercial-scheduler.mjs";
import { prepareCommercialSweep } from "@/lib/commercial-sweep";
import { supabaseBrowserConfig } from "@/lib/supabase/config";
import { withAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const email = process.env.BIS_COMMERCIAL_AUTOMATION_EMAIL;
  const password = process.env.BIS_COMMERCIAL_AUTOMATION_PASSWORD;
  return handleCommercialSchedule({
    authorization: request.headers.get("authorization"), secret: process.env.CRON_SECRET,
    enabled: process.env.BIS_COMMERCIAL_AUTOMATION_ENABLED === "true", accountConfigured: Boolean(email && password),
  }, async () => {
    const { url, publishableKey } = supabaseBrowserConfig();
    const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const signedIn = await client.auth.signInWithPassword({ email: email!, password: password! });
    if (signedIn.error || !signedIn.data.session) throw new AccessError("Scheduled commercial access is unavailable.", 403);
    try {
      return await withAuthenticatedSupabaseClient(client, prepareCommercialSweep);
    } finally { await client.auth.signOut({ scope: "local" }); }
  });
}

// A trusted record-change webhook can request the same idempotent preparation.
// It receives no authority to send messages or alter commercial terms.
export const POST = GET;
