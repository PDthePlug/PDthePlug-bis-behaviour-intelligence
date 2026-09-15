import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/programmes/[asset]": ["./public/programmes/chunks/**/*"],
  },
};

export default nextConfig;
