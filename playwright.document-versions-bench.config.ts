import { defineConfig } from '@playwright/test';
import base from './playwright.workflow-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'document-versions.bench.spec.ts',
  outputDir: '.test-results/document-versions-bench',
});
