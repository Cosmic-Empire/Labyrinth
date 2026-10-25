import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentUpgrade: "security",
    agentFeedback: true,
    turbopackFileSystemCacheForDev: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        condition: {
          not: "foreign",
        },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "**/node_modules/**/*.css": {
        condition: "foreign",
        type: "css",
      },
    },
  },
};

export default nextConfig;
