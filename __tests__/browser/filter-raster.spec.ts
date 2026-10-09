import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/filter-raster';

test('filter rasters preserve native Path2D contours, conic angles and multiline text alpha', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/filter-raster.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(await page.evaluate(() => window.filterRasterTest.path())).toEqual({
    fill: [
      [255, 0, 0, 255],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    stroke: [
      [255, 255, 255, 255],
      [0, 0, 0, 0],
      [255, 255, 255, 255],
    ],
  });
  expect(await page.evaluate(() => window.filterRasterTest.conic())).toEqual([
    [255, 0, 0, 255],
    [0, 0, 255, 255],
  ]);
  const text = await page.evaluate(() => window.filterRasterTest.text());
  for (const max of text.maxima)
    expect(Math.abs(max - 128)).toBeLessThanOrEqual(1);
  expect(text.outside).toEqual([0, 0, 0, 0]);
  expect(errors).toEqual([]);
});
