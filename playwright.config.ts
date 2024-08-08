import { devices, defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 10 : undefined,
  reporter: process.env.CI ? 'blob' : 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: 'http://localhost:8080',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        screenshot: 'on',
        launchOptions: {
          args: [
            '--headless',
            '--no-sandbox',
            '--use-angle=gl',
            '--enable-unsafe-webgpu',
          ],
        },
      },
    },
  ],
  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev:e2e',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  snapshotPathTemplate: '{testDir}/snapshots/{arg}{ext}',
});
