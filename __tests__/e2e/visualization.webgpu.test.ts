import { test, expect } from '@playwright/test';
import tests from './config.json';

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + 160000);
});

test.describe('Visual Regression WebGPU', () => {
  tests.forEach(({ name }) => {
    const renderer = 'webgpu';
    test(`${name} with ${renderer}`, async ({ page, context }) => {
      let resolveReadyPromise: () => void;
      const readyPromise = new Promise((resolve) => {
        resolveReadyPromise = () => {
          resolve(this);
        };
      });

      await context.exposeFunction('screenshot', async () => {
        resolveReadyPromise();
      });

      const url = `./infinitecanvas/?name=${name}&renderer=${renderer}`;
      await page.goto(url);
      await readyPromise;

      await expect(page.locator('canvas')).toHaveScreenshot([
        renderer,
        `${name}.png`,
      ]);
    });
  });
});
