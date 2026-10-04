import { createClient } from "./supabase/server";

type ActiveLabRuntime = {
  route_path: string | null;
  runtime_mode: string;
  version_id: string;
  version: string;
};

export async function liveUniversalLabHref(
  code: string,
  options: { returnTo?: string | null; step?: number | null } = {},
) {
  const labCode = code.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(labCode)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("active_bis_lab_runtime", { target_code: labCode });
  const runtime = (Array.isArray(data) ? data[0] : data) as ActiveLabRuntime | null;
  if (error || !runtime || runtime.runtime_mode !== "DYNAMIC") return null;

  const base = runtime.route_path || `/labs/${labCode.toLowerCase()}`;
  const params = new URLSearchParams();
  if (options.returnTo?.startsWith("/") && !options.returnTo.startsWith("//")) {
    params.set("returnTo", options.returnTo);
  }
  if (Number.isInteger(options.step) && Number(options.step) >= 1 && Number(options.step) <= 9) {
    params.set("step", String(options.step));
  }
  return params.size ? `${base}?${params.toString()}` : base;
}
