import { defineConfig } from '@playwright/test';
import base from './playwright.polyline-lod.config';
import webkit from './playwright.webkit.config';
export default defineConfig({
  ...base,
  use: webkit.use,
  timeout: webkit.timeout,
  outputDir: '.test-results/polyline-lod-webkit',
});
