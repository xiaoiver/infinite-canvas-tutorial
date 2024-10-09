import { test, expect } from '@playwright/test';
import tests from './config.json';

const renderer = 'webgl2';

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + 160000);
});

test.describe('E2E Suite', () => {
  tests.forEach(({ name }) => {
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

      const url = `./infinitecanvas/?name=${name}&renderer=webgl`;
      await page.goto(url);
      await readyPromise;

      await expect(page.locator('canvas')).toHaveScreenshot([
        renderer,
        `${name}.png`,
      ]);
    });
  });
});
