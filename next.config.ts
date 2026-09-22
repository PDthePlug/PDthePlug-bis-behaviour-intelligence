import type { NextConfig } from "next";
import { BIS_PRODUCTION_ORIGIN } from "./lib/auth-redirect";

const nextConfig: NextConfig = {
  async redirects() {
    return ["bisportal.online", "bis-behaviour-intelligence.vercel.app"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${BIS_PRODUCTION_ORIGIN}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    const authHeaders = ["/auth/:path*", "/sign-in", "/forgot-password", "/reset-password"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
    return [...authHeaders, {
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
    "/programmes/[asset]": ["./public/programmes/chunks/**/*"],
  },
};

export default nextConfig;
