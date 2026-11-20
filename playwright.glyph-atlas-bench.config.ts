import { defineConfig } from '@playwright/test';
import base from './playwright.mixed-renderer-bench.config';
export default defineConfig({
  ...base,
  testMatch: 'glyph-atlas.bench.spec.ts',
  outputDir: '.test-results/glyph-atlas-bench',
  webServer: {
    ...base.webServer,
    url: 'http://127.0.0.1:4175/glyph-atlas.html',
  },
});
