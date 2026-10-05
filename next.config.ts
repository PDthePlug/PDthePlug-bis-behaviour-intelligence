import type { NextConfig } from "next";
import { BIS_PRODUCTION_ORIGIN } from "./lib/auth-redirect";

const productionSupabaseAcknowledgement =
  process.env.NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE === "true"
    ? "true"
    : process.env.VERCEL_ENV === "production"
      ? "true"
      : "false";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BIS_ALLOW_PRODUCTION_SUPABASE: productionSupabaseAcknowledgement,
  },
  async redirects() {
    return ["bisportal.online", "bis-behaviour-intelligence.vercel.app"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${BIS_PRODUCTION_ORIGIN}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    const globalSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ...(process.env.VERCEL_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
    ];
    const authHeaders = ["/auth/:path*", "/sign-in", "/forgot-password", "/reset-password"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
    return [{ source: "/:path*", headers: globalSecurityHeaders }, ...authHeaders, {
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ],
    }];
  },
  outputFileTracingIncludes: {
    "/api/staff": ["./assets/report-fonts/**/*"],
    "/experience/leap9/report": ["./assets/report-fonts/**/*"],
    "/programmes/[asset]": ["./public/programmes/chunks/**/*"],
  },
};

export default nextConfig;
