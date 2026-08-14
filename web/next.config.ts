import path from "node:path";
import type { NextConfig } from "next";

const appDir = process.cwd();
const laravelOrigin = (
  process.env.LARAVEL_ORIGIN ??
  (process.env.NODE_ENV === "production"
    ? "https://api.genky.vn"
    : "http://127.0.0.1:8000")
).replace(/\/$/, "");

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
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${laravelOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
