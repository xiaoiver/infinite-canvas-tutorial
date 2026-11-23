import { defineConfig } from '@playwright/test';
import base from './examples/workflow-canvas/playwright.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'workflow-navigation.bench.spec.ts',
  outputDir: '.test-results/workflow-bench',
  timeout: 600000,
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4181',
    trace: 'off',
    screenshot: 'off',
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --config examples/workflow-canvas/vite.bench.config.ts',
    cwd: '.',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
