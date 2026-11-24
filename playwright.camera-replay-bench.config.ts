import { defineConfig } from '@playwright/test';
import base from './playwright.stroke-reuse-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'camera-replay.bench.spec.ts',
  outputDir: '.test-results/camera-replay-bench',
});
