import { defineConfig } from '@playwright/test';
import base from './playwright.workflow-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'workflow-replay.bench.spec.ts',
  outputDir: '.test-results/workflow-replay-bench',
});
