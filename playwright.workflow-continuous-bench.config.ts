import { defineConfig } from '@playwright/test';
import base from './playwright.workflow-input-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'workflow-continuous.bench.spec.ts',
  outputDir: '.test-results/workflow-continuous-bench',
});
