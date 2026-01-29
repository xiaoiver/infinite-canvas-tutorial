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
      name: 'webgl2',
      testMatch: '**/*webgl2.test.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: true,
        screenshot: 'on',
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader', // 强制使用软件渲染
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu', // 有时禁用 GPU 反而能触发软件渲染回退
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
