import { defineConfig } from '@playwright/test';
import base from './playwright.text-batching-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'edit-phases.bench.spec.ts',
  outputDir: '.test-results/edit-phases-bench',
});
