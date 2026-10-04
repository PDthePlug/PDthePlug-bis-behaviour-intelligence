import { requestSupabaseClient } from "./supabase/server";

/** Dedicated APIs serve only the explicitly governed compatibility version. */
export async function legacyLabGuard(code: string, expectedVersion: string) {
  const result = await requestSupabaseClient().rpc("learner_bis_lab_runtime", { target_code: code });
  if (result.error) return Response.json({ error: "Lab availability could not be checked." }, { status: 503 });
  const runtime = result.data?.[0];
  if (runtime?.runtime_mode !== "STATIC" || runtime.version !== expectedVersion) {
    return Response.json({ error: "Open your published Lab to continue.", redirectTo: `/labs/${code.toLowerCase()}` }, { status: 409 });
  }
  return null;
}
