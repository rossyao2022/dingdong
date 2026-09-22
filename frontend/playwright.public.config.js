import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './deployment-tests',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.PUBLIC_HTTP_URL || 'http://110.42.225.196/dingdong/',
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop' },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  reporter: 'list',
});
