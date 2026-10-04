import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // The complete nine-investigation journey exercises more than one hundred
  // controls. Running viewport copies concurrently can starve the dev server
  // and turn a passing journey into a test-timeout failure on small runners.
  workers: 1,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    } : {},
  },
  projects: [
    { name: "mobile-360", use: { viewport: { width: 360, height: 800 } } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://bis-harness.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_harness_not_a_credential" },
    command: "npx next dev tests/browser/harness --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/labs/ldr",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
