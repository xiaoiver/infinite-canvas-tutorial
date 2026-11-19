import { defineConfig } from '@playwright/test';
import base from './playwright.polyline-lod.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'mixed-renderer.bench.spec.ts',
  outputDir: '.test-results/mixed-renderer-bench',
  use: { ...base.use, trace: 'off', screenshot: 'off' },
});
