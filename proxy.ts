import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Only this explicitly public, fictional experience bypasses session refresh.
  // Live programme routes retain the existing authentication and role checks.
  if (["/experience/leap9", "/experience/leap9/report"].includes(request.nextUrl.pathname)) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|manifest\\.webmanifest$|offline\\.html$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};


