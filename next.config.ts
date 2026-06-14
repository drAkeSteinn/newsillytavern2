import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost', '.space-z.ai'],
  serverExternalPackages: [
    '@lancedb/lancedb',
    '@lancedb/lancedb-win32-x64-msvc',
    '@lancedb/lancedb-darwin-x64',
    '@lancedb/lancedb-darwin-arm64',
    '@lancedb/lancedb-linux-x64-gnu',
    '@lancedb/lancedb-linux-arm64-gnu',
    '@lancedb/lancedb-linux-x64-musl',
    '@lancedb/lancedb-linux-arm64-musl',
  ],
};

export default nextConfig;
