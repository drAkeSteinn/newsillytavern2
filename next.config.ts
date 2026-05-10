import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Externalize native packages so Turbopack doesn't try to bundle platform-specific bindings
  // This prevents "could not resolve @lancedb/lancedb-win32-x64-msvc" errors on any platform
  serverExternalPackages: [
    "@lancedb/lancedb",
    "apache-arrow",
  ],
};

export default nextConfig;
