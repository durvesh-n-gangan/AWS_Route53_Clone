import type { NextConfig } from "next";

// Where the FastAPI backend listens. The browser never calls it directly: every
// /api/* request is proxied through this app, so the session cookie stays first-party.
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
