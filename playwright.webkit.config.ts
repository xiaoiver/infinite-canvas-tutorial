import { defineConfig, devices } from '@playwright/test';
import browserConfig from './playwright.browser.config';

export default defineConfig({
  ...browserConfig,
  testMatch: 'touch-webkit.spec.ts',
  testIgnore: [],
  outputDir: '.test-results/webkit',
  timeout: 60000,
  use: {
    ...browserConfig.use,
    ...devices['iPhone 13'],
    browserName: 'webkit',
    launchOptions: {},
  },
});
