import { defineConfig } from '@playwright/test';
import base from './playwright.polyline-lod.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'polyline-lod.bench.spec.ts',
  outputDir: '.test-results/polyline-lod-bench',
  use: { ...base.use, trace: 'off', screenshot: 'off' },
});
