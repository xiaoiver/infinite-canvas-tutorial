import { defineConfig } from '@playwright/test';
import base from './playwright.glyph-atlas-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'text-batching.bench.spec.ts',
  outputDir: '.test-results/text-batching-bench',
});
