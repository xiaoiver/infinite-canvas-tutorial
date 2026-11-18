import { defineConfig } from '@playwright/test';
import base from './playwright.browser.config';
export default defineConfig({
  ...base,
  testMatch: 'batching.spec.ts',
  webServer: {
    ...base.webServer,
    url: 'http://127.0.0.1:4175/batching.html',
    command: 'npx vite --config __tests__/browser/batching.vite.config.ts',
  },
});
