import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Only these explicitly public, fictional experiences bypass session refresh.
  // Live programme routes retain the existing authentication and role checks.
  if ([
    "/experience/leap9", "/experience/leap9/v2", "/experience/leap9/report",
    "/experience/dgmt", "/experience/dgmt/report",
    "/experience/dgmt-overview.mp4", "/experience/dgmt-overview.vtt",
  ].includes(request.nextUrl.pathname)) {
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
