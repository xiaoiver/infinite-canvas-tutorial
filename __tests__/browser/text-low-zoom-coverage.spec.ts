import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type {} from './fixtures/design-to-code-docs';

test.use({ deviceScaleFactor: 2 });

test('dashboard digits retain their center stroke at low zoom', async ({
  page,
}) => {
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs?.scene()), {
      timeout: 30000,
    })
    .toBe('dashboard');
  await page.evaluate(() => window.designToCodeDocs.setZoom(0.52));
  await expect
    .poll(() =>
      page.evaluate(() => window.designToCodeDocs.camera()?.cameraZoom),
    )
    .toBeCloseTo(0.52);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

  const bounds = await page.evaluate(() =>
    window.designToCodeDocs.ordersValueBounds(),
  );
  expect(bounds).toBeDefined();
  const png = PNG.sync.read(
    await page.locator('ic-spectrum-canvas canvas').screenshot(),
  );
  const dpr = 2;
  const right = Math.round(bounds!.max.x * dpr);
  const waistTop = Math.round(bounds!.min.y * dpr) + 18;
  // Sample the center of the final 8 rather than its upper loop. A blank row
  // through the waist would make the glyph appear split at small zoom.
  for (let y = waistTop; y < waistTop + 5; y++) {
    let rowInk = 0;
    for (let x = right - 17; x < right + 3; x++) {
      const offset = (y * png.width + x) * 4;
      const brightness =
        (png.data[offset] + png.data[offset + 1] + png.data[offset + 2]) / 3;
      if (brightness < 70) rowInk++;
    }
    expect(rowInk).toBeGreaterThanOrEqual(2);
  }
});
