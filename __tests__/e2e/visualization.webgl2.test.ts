import { test, expect } from '@playwright/test';

const renderer = 'webgl2';

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + 160000);
});

test.describe('E2E Suite', () => {
  [
    'grid_lines',
    'grid_dots',
    'circle',
    'ellipse',
    'rect',
    'drop-shadow',
  ].forEach((name) => {
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
