import { defineConfig } from '@playwright/test';
import base from './playwright.image-texture-sharing-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'image-batching.bench.spec.ts',
  outputDir: '.test-results/image-batch-bench',
  timeout: 300000,
  use: {
    ...base.use,
    launchOptions: {
      ...base.use.launchOptions,
      executablePath: process.env.WORKFLOW_CHROMIUM || undefined,
    },
  },
  webServer: {
    ...base.webServer,
    cwd: '.',
    command:
      'node node_modules/vite/bin/vite.js --config __tests__/browser/stroke-batching.vite.config.ts',
    url: 'http://127.0.0.1:4175/image-sharing.html',
    reuseExistingServer: false,
  },
});
