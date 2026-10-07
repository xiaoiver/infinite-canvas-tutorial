import { defineConfig, devices } from '@playwright/test';
import browserConfig from './playwright.browser.config';

export default defineConfig({
  ...browserConfig,
  testMatch: [
    'touch-webkit.spec.ts',
    'dash-rendering.spec.ts',
    'ecs-dash-rendering.spec.ts',
    'text-path.spec.ts',
    'ecs-text.spec.ts',
    'ecs-text-resize.spec.ts',
    'ecs-text-path.spec.ts',
    'ecs-blend-mode.spec.ts',
    'size-label.spec.ts',
  ],
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
