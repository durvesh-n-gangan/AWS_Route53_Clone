import { defineConfig } from "@playwright/test";

// The E2E run starts its own backend (fresh SQLite file, seeded demo user) and frontend on
// separate ports, so it never touches the data of a dev server running on 3000/8000.
const BACKEND_PORT = 8001;
const FRONTEND_PORT = 3100;
const E2E_DB = "sqlite:///./data/e2e.db";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    // Uses the locally installed Google Chrome; set PW_CHANNEL="" to use Playwright's Chromium.
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        `rm -f data/e2e.db && DATABASE_URL=${E2E_DB} .venv/bin/alembic upgrade head && ` +
        `DATABASE_URL=${E2E_DB} .venv/bin/python -m app.db.seed && ` +
        `DATABASE_URL=${E2E_DB} FRONTEND_ORIGIN=http://localhost:${FRONTEND_PORT} ` +
        `.venv/bin/uvicorn app.main:app --port ${BACKEND_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${BACKEND_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // A production build in its own folder: `next dev` allows one server per project.
      command: `cp tsconfig.json tsconfig.e2e.json && npx next build && npx next start -p ${FRONTEND_PORT}`,
      env: { BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`, NEXT_DIST_DIR: ".next-e2e" },
      url: `http://localhost:${FRONTEND_PORT}/login`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
