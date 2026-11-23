import { defineConfig } from '@playwright/test';
import base from './playwright.stroke-batching-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'stroke-reuse.bench.spec.ts',
  outputDir: '.test-results/stroke-reuse-bench',
});
