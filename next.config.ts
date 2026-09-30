import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "pg", "@sparticuz/chromium"],
  // The serverless Chromium ships as compressed files that file tracing does not pick up on its own.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  agentRules: false,
};

export default nextConfig;
