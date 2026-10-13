import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`next build && next start`).
 *   npm run build && npm run test:e2e
 * PLAYWRIGHT_BASE_URL can point the suite at an already running server instead.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
/** Use an installed browser instead of Playwright's download, e.g. E2E_CHANNEL=chrome or msedge. */
const channel = process.env.E2E_CHANNEL || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/api/v1/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NODE_ENV: "production",
          SHARE_TOKEN_SECRET: "e2e-only-share-secret-0123456789abcdefghij",
          GEOCODING_PROVIDER: "open-meteo",
          RATE_LIMIT_READINGS_PER_MINUTE: "200",
        },
      },
});
