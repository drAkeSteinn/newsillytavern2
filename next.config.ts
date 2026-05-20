import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-346996a9-c94c-4d4e-8696-5c557cf88d3e.space-z.ai",
  ],
};

export default nextConfig;
