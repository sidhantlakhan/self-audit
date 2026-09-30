import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "pg"],
  agentRules: false,
};

export default nextConfig;
