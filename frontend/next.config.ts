import type { NextConfig } from "next";

// Where the FastAPI backend listens. The browser never calls it directly: every
// /api/* request is proxied through this app, so the session cookie stays first-party.
if (process.env.VERCEL && !process.env.BACKEND_URL) {
  // Without it every /api call would go to localhost and the deployed app could not sign in.
  throw new Error("Set BACKEND_URL in the Vercel project settings (the Render API URL).");
}
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // The Playwright run builds into its own folder so it can't clash with `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // ...and points at a throwaway tsconfig copy, because Next adds its build folder to it.
  ...(process.env.NEXT_DIST_DIR ? { typescript: { tsconfigPath: "tsconfig.e2e.json" } } : {}),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
