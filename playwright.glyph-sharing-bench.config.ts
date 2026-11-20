import { defineConfig } from '@playwright/test';
import base from './playwright.glyph-atlas-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'glyph-sharing.bench.spec.ts',
  outputDir: '.test-results/glyph-sharing-bench',
});
