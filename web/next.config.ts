import path from "node:path";
import type { NextConfig } from "next";

const appDir = process.cwd();

const nextConfig: NextConfig = {
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
    ],
  },
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
