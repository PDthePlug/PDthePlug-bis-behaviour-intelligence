import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeReturnPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/habit";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeReturnPath(url.searchParams.get("next")), url.origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=confirmation&next=%2Fhabit", url.origin));
}
