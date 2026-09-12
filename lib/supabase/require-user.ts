import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";

export async function requireUser(next = "/") {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  return data.user as User & { email: string };
}
