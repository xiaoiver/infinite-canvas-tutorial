import { defineConfig } from '@playwright/test';
import base from './playwright.browser.config';

/** Serve the full VitePress output, including its actual chunk graph and routing. */
export default defineConfig({
  ...base,
  testDir: './__tests__/site-production',
  testMatch: '*.spec.ts',
  testIgnore: [],
  outputDir: '.test-results/site-production',
  timeout: 60000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4181' },
  webServer: {
    command:
      'node packages/site/node_modules/vitepress/bin/vitepress.js preview packages/site/docs --host 127.0.0.1 --port 4181',
    url: 'http://127.0.0.1:4181/example/text-lod',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
