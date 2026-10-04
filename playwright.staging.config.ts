import { defineConfig } from "@playwright/test";

const port = Number(process.env.BIS_STAGING_APP_PORT || 3200);
const baseURL = process.env.BIS_STAGING_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/staging",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 45_000 },
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report-staging", open: "never" }]],
  globalSetup: "./tests/staging/global-setup.ts",
  outputDir: "test-results-staging",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    proxy: process.env.BIS_STAGING_BROWSER_PROXY ? {
      server: process.env.BIS_STAGING_BROWSER_PROXY,
      bypass: "127.0.0.1,localhost",
    } : undefined,
    ignoreHTTPSErrors: process.env.BIS_STAGING_PROXY_CERTIFICATE === "workspace",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    } : {},
  },
  projects: [{ name: "staging-chromium", use: { browserName: "chromium" } }],
  webServer: process.env.BIS_STAGING_BASE_URL ? undefined : {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
