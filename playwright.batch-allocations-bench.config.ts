import { defineConfig } from '@playwright/test';
import base from './playwright.text-batching-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'batch-allocations.bench.spec.ts',
  outputDir: '.test-results/batch-allocations-bench',
});
