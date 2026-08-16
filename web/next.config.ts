import path from "node:path";
import type { NextConfig } from "next";

const appDir = process.cwd();

const pageCacheHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-cache, no-store, max-age=0, must-revalidate",
  },
  {
    key: "X-LiteSpeed-Cache-Control",
    value: "no-cache",
  },
  {
    key: "Vary",
    value:
      "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept",
  },
];

const nextConfig: NextConfig = {
  assetPrefix: "/assets",
  outputFileTracingRoot: appDir,
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  turbopack: {
    root: appDir,
  },
  webpack: (config) => {
    config.parallelism = 1;
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.join(appDir, "src"),
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "api.genky.vn" },
    ],
  },
  async headers() {
    return [
      {
        source: "/login",
        headers: pageCacheHeaders,
      },
      {
        source: "/:path((?!_next|assets|favicon.ico).*)",
        headers: pageCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
