import { defineConfig } from '@playwright/test';
import base from './playwright.browser.config';
export default defineConfig({
  ...base,
  testMatch: 'polyline-lod.spec.ts',
  webServer: {
    ...base.webServer,
    url: 'http://127.0.0.1:4175/polyline-lod.html',
    command:
      'node node_modules/vite/bin/vite.js --config __tests__/browser/text-lod.vite.config.ts',
  },
});
