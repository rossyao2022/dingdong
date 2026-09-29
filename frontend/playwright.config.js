import { defineConfig, devices } from "@playwright/test";
const isolatedBaseURL = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: isolatedBaseURL || "http://127.0.0.1:4173",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    screenshot: "only-on-failure",
  },
  webServer: isolatedBaseURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
      },
  reporter: "list",
});
