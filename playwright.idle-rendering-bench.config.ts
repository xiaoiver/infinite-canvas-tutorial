import { defineConfig } from '@playwright/test';
import base from './playwright.edit-phases-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'idle-rendering.bench.spec.ts',
  outputDir: '.test-results/idle-rendering-bench',
});
