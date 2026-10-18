import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Only these explicitly public, fictional experiences bypass session refresh.
  // Live programme routes retain the existing authentication and role checks.
  if ([
    "/explore",
    "/experience/development-system", "/experience/development-system/report",
    "/experience/leap9", "/experience/leap9/v2", "/experience/leap9/report",
    "/experience/dgmt", "/experience/dgmt/report",
    "/experience/first-look", "/experience/first-look/report",
    "/experience/vodacom/v2", "/experience/vodacom/report",
    "/experience/sasol/v2", "/experience/sasol/report",
    "/experience/primestars/v2", "/experience/primestars/report",
    "/experience/jasa/v2", "/experience/jasa/report",
    "/experience/momentum/v2", "/experience/momentum/report",
    "/experience/tutuwa/v2", "/experience/tutuwa/report",
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
