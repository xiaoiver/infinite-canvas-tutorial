import { defineConfig } from '@playwright/test';
import base from './playwright.workflow-bench.config';
const webkit = process.env.WORKFLOW_INPUT_BROWSER === 'webkit';
export default defineConfig({
  ...base,
  testMatch: 'workflow-input.bench.spec.ts',
  outputDir: '.test-results/workflow-input-bench',
  use: {
    ...base.use,
    browserName: webkit ? 'webkit' : 'chromium',
    launchOptions: webkit ? {} : base.use?.launchOptions,
  },
});
