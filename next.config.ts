import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-27e4e197-62c7-4b1a-9264-f4ba5d69a857.space.z.ai',
    '.space.z.ai',
    'localhost',
  ],

  // Externalize native modules so they are loaded at runtime, not bundled.
  // Without this, Turbopack/Webpack tries to bundle .node native files,
  // which breaks with "Cannot find native binding".
  // Works for both Turbopack (default in Next 16) and Webpack.
  serverExternalPackages: [
    '@lancedb/lancedb',
    '@lancedb/lancedb-linux-x64-gnu',
    '@lancedb/lancedb-linux-x64-musl',
    '@lancedb/lancedb-linux-arm64-gnu',
    '@lancedb/lancedb-linux-arm64-musl',
    '@lancedb/lancedb-darwin-arm64',
    '@lancedb/lancedb-win32-x64-msvc',
    '@lancedb/lancedb-win32-arm64-msvc',
  ],
};

export default nextConfig;
