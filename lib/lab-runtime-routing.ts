import { createClient } from "./supabase/server";

export async function liveUniversalLabHref(
  code: string,
  options: { returnTo?: string | null; step?: number | null } = {},
) {
  const labCode = code.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(labCode)) return null;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("content_library_items")
    .select("id,route_path")
    .eq("kind", "LAB")
    .eq("code", labCode)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!item) return null;

  const { data: activation } = await supabase
    .from("content_runtime_activations")
    .select("version_id,runtime_mode,status")
    .eq("item_id", item.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!activation || activation.runtime_mode !== "DYNAMIC") return null;

  const { data: version } = await supabase
    .from("content_library_versions")
    .select("runtime_status,status")
    .eq("id", activation.version_id)
    .maybeSingle();
  if (!version || version.runtime_status !== "LIVE" || version.status !== "PUBLISHED") return null;

  const base = item.route_path || `/labs/${labCode.toLowerCase()}`;
  const params = new URLSearchParams();
  if (options.returnTo?.startsWith("/") && !options.returnTo.startsWith("//")) {
    params.set("returnTo", options.returnTo);
  }
  if (Number.isInteger(options.step) && Number(options.step) >= 1 && Number(options.step) <= 9) {
    params.set("step", String(options.step));
  }
  return params.size ? `${base}?${params.toString()}` : base;
}
