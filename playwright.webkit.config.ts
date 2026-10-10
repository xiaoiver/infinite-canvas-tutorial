import { defineConfig, devices } from '@playwright/test';
import browserConfig from './playwright.browser.config';

// Locally run every suite. CI balances Lottie against the remaining WebKit
// tests on independent single-worker runners, preserving browser isolation.
const group = process.env.PLAYWRIGHT_WEBKIT_GROUP || 'all';
if (!['all', 'lottie', 'other'].includes(group)) {
  throw new Error(`Unknown PLAYWRIGHT_WEBKIT_GROUP: ${group}`);
}

export default defineConfig({
  ...browserConfig,
  testMatch: [
    'touch-webkit.spec.ts',
    'dash-rendering.spec.ts',
    'ecs-dash-rendering.spec.ts',
    'path-rendering.spec.ts',
    'text-path.spec.ts',
    'ecs-text.spec.ts',
    'ecs-text-resize.spec.ts',
    'ecs-text-path.spec.ts',
    'ecs-blend-mode.spec.ts',
    'brush.spec.ts',
    'image-fill.spec.ts',
    'group-inheritance.spec.ts',
    'rough-properties.spec.ts',
    'gizmo.spec.ts',
    'gizmo-worlds.spec.ts',
    'interaction-precision.spec.ts',
    'size-label.spec.ts',
    'lasso.spec.ts',
    'icon-resize.spec.ts',
    'lottie.spec.ts',
    'lottie-docs.spec.ts',
    'd2-docs.spec.ts',
  ].filter(
    (file) =>
      group === 'all' ||
      (file === 'lottie.spec.ts' ? group === 'lottie' : group === 'other'),
  ),
  testIgnore: [],
  outputDir: '.test-results/webkit',
  timeout: 60000,
  use: {
    ...browserConfig.use,
    ...devices['iPhone 13'],
    browserName: 'webkit',
    launchOptions: {},
  },
});
