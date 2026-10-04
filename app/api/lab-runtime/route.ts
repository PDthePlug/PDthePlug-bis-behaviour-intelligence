import { withSupabaseRequest } from "@/db";
import { getRoles, identityFrom } from "@/lib/bis-access";
import { requestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  return withSupabaseRequest(async () => {
    const identity = await identityFrom();
    if (!identity) return Response.json({ error: "Sign in is required." }, { status: 401 });
    const code = (new URL(request.url).searchParams.get("lab") || "").toUpperCase();
    if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(code)) return Response.json({ error: "Choose a valid Lab." }, { status: 400 });
    const [result, roles] = await Promise.all([requestSupabaseClient().rpc("learner_bis_lab_runtime", { target_code: code }), getRoles(identity)]);
    if (result.error) return Response.json({ error: "Lab availability could not be checked." }, { status: 503 });
    const runtime = result.data?.[0];
    return Response.json({ runtimeMode: runtime?.runtime_mode ?? null, version: runtime?.version ?? null, roles }, { headers: { "cache-control": "private, no-store" } });
  });
}
