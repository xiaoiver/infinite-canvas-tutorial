import { defineConfig } from '@playwright/test';
import base from './playwright.polyline-lod.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'path-instancing.bench.spec.ts',
  outputDir: '.test-results/path-instancing-bench',
  use: { ...base.use, trace: 'off', screenshot: 'off' },
});
