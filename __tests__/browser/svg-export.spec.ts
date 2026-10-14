import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/svg-export';

test.beforeEach(async ({ page }) => {
  await page.goto('/svg-export.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});

for (const [repetition, horizontal, vertical] of [
  ['repeat', true, true],
  ['repeat-x', true, false],
  ['repeat-y', false, true],
  ['no-repeat', false, false],
] as const) {
  test(`SVG ${repetition} matches Canvas2D pixels`, async ({ page }) => {
    const result = await page.evaluate(
      (mode) => window.svgExportTest.pattern(mode),
      repetition,
    );
    expect(result.samples).toEqual([
      [255, 0, 0, 255],
      [0, 0, 255, 255],
      horizontal ? [255, 0, 0, 255] : [0, 0, 0, 0],
      vertical ? [255, 0, 0, 255] : [0, 0, 0, 0],
    ]);
    expect(result.differingChannels).toBe(0);
  });
}

for (const paint of ['gradient', 'image', 'pattern'] as const) {
  test(`SVG text retains visible ${paint} paint`, async ({ page }) => {
    const result = await page.evaluate(
      (type) => window.svgExportTest.text(type),
      paint,
    );
    expect(result.painted).toBeGreaterThan(200);
    expect(result.colored).toBe(result.painted);
  });
}
