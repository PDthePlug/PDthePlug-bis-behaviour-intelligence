import { NextResponse } from "next/server";
import { applicationOrigin, safeReturnPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = applicationOrigin(url.origin);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  const signInUrl = new URL("/sign-in", origin);
  signInUrl.searchParams.set("error", "confirmation");
  signInUrl.searchParams.set("next", next);
  return NextResponse.redirect(signInUrl);
}
