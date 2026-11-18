import { defineConfig } from '@playwright/test';
import base from './playwright.text-lod.config';
export default defineConfig({
  ...base,
  outputDir: '.test-results/text-lod-bench',
  use: { ...base.use, trace: 'off', screenshot: 'off' },
  testDir: './scripts',
  testMatch: 'text-lod.bench.spec.ts',
});
