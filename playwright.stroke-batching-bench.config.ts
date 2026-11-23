import { defineConfig } from '@playwright/test';
import base from './playwright.browser.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'stroke-batching.bench.spec.ts',
  outputDir: '.test-results/stroke-batch-bench',
  timeout: 300000,
  use: {
    ...base.use,
    trace: 'off',
    screenshot: 'off',
    launchOptions: {
      ...base.use.launchOptions,
      executablePath: process.env.WORKFLOW_CHROMIUM || undefined,
    },
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --config __tests__/browser/stroke-batching.vite.config.ts',
    cwd: '.',
    url: 'http://127.0.0.1:4175/core-path-instances.html',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
