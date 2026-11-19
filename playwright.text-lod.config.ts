import { defineConfig } from '@playwright/test';
import base from './playwright.browser.config';
export default defineConfig({
  ...base,
  testMatch: ['text-lod.spec.ts', 'text-proxy-instancing.spec.ts'],
  webServer: {
    ...base.webServer,
    url: 'http://127.0.0.1:4175/text-lod.html',
    command: 'npx vite --config __tests__/browser/text-lod.vite.config.ts',
  },
});
