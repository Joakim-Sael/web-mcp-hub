import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@web-mcp-hub/db"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
};

export default nextConfig;
