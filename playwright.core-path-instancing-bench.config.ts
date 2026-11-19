import { defineConfig } from '@playwright/test';
import base from './playwright.core-path-instancing.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'core-path-instancing.bench.spec.ts',
  outputDir: '.test-results/core-path-instancing-bench',
  use: { ...base.use, trace: 'off', screenshot: 'off' },
});
