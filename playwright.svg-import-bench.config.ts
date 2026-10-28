import { defineConfig } from '@playwright/test';
import browserConfig from './playwright.browser.config';

export default defineConfig({
  ...browserConfig,
  testMatch: 'svg-import-profile.bench.ts',
  testIgnore: [],
});
