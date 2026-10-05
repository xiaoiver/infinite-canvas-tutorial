import { defineConfig, devices } from '@playwright/test';
import reactConfig from './playwright.react.config';

export default defineConfig({
  ...reactConfig,
  testMatch: ['mobile.spec.ts', 'text-edits.spec.ts'],
  outputDir: '.test-results/react-webkit',
  use: {
    ...reactConfig.use,
    ...devices['iPhone 13'],
    browserName: 'webkit',
    launchOptions: {},
  },
});
