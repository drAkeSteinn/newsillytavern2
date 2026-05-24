import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: [
    "@lancedb/lancedb",
    "@lancedb/lancedb-linux-x64-gnu",
    "@lancedb/lancedb-linux-x64-musl",
    "@lancedb/lancedb-win32-x64-msvc",
    "@lancedb/lancedb-darwin-x64",
    "@lancedb/lancedb-darwin-arm64",
  ],
  allowedDevOrigins: [
    "preview-chat-346996a9-c94c-4d4e-8696-5c557cf88d3e.space-z.ai",
    "preview-chat-22ce42c3-d5dc-400f-9632-f69a727fa65a.space-z.ai",
  ],
};

export default nextConfig;
