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
};

export default nextConfig;
