import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "cache-upgrade.spec.js",
  workers: 1,
  timeout: 30000,
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    viewport: { width: 390, height: 844 },
  },
  reporter: "list",
});
