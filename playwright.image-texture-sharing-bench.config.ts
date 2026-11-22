import { defineConfig } from '@playwright/test';
import base from './playwright.mixed-renderer-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'image-texture-sharing.bench.spec.ts',
  outputDir: '.test-results/image-texture-sharing-bench',
  use: { ...base.use, viewport: { width: 1000, height: 760 } },
  webServer: {
    ...base.webServer,
    url: 'http://127.0.0.1:4175/image-sharing.html',
    reuseExistingServer: false,
  },
});
