import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  outputDir: '../../.test-results/workflow-canvas',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:4180',
    viewport: { width: 1500, height: 980 },
    launchOptions: {
      executablePath: process.env.WORKFLOW_CHROMIUM || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --config examples/workflow-canvas/vite.config.ts',
    cwd: '../..',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
