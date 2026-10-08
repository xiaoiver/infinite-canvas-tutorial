import { defineConfig, devices } from '@playwright/test';
import reactConfig from './playwright.react.config';

export default defineConfig({
  ...reactConfig,
  testMatch: [
    'mobile.spec.ts',
    'text-edits.spec.ts',
    'drawing-preferences.spec.ts',
    'design-variable-edits.spec.ts',
    'theme-preferences.spec.ts',
    'selection-edits.spec.ts',
    'image-tool.spec.ts',
    'crop-edits.spec.ts',
  ],
  outputDir: '.test-results/react-webkit',
  use: {
    ...reactConfig.use,
    ...devices['iPhone 13'],
    browserName: 'webkit',
    launchOptions: {},
  },
});
