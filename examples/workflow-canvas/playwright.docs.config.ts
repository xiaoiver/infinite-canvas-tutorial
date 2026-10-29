import { defineConfig } from '@playwright/test';

const preview = process.env.WORKFLOW_DOCS_PREVIEW === '1';
export default defineConfig({
  testDir: '.',
  testMatch: 'docs.spec.ts',
  outputDir: '../../.test-results/workflow-docs',
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  use: {
    baseURL: 'http://127.0.0.1:4179',
    viewport: { width: 1500, height: 980 },
    launchOptions: {
      executablePath: process.env.WORKFLOW_CHROMIUM || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm --filter @infinite-canvas-tutorial/site ${
      preview ? 'preview' : 'dev'
    } --host 127.0.0.1 --port 4179`,
    cwd: '../..',
    url: 'http://127.0.0.1:4179/zh/example/workflow-canvas',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
