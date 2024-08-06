import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + 160000);
});

test.describe('E2E Suite', () => {
  ['circle'].forEach((name) => {
    test(name, async ({ page, context }) => {
      //   const createReadyPromise = async (context: BrowserContext) => {
      let resolveReadyPromise: () => void;
      const readyPromise = new Promise((resolve) => {
        resolveReadyPromise = () => {
          resolve(this);
        };
      });

      await context.exposeFunction('screenshot', async () => {
        resolveReadyPromise();
      });

      const url = `./infinitecanvas/?name=${name}`;
      await page.goto(url);
      await readyPromise;

      await expect(page.locator('canvas')).toHaveScreenshot(`${name}.png`);
    });
  });
});
