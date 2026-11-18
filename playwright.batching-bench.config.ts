import { defineConfig } from '@playwright/test';
import base from './playwright.batching.config';
export default defineConfig({
  ...base,
  testDir: './scripts',
  testMatch: 'batching.bench.spec.ts',
});
