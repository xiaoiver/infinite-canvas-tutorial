import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gradient-geometry';

test.beforeEach(async ({ page }) => {
  await page.goto('/gradient-geometry.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});

for (const angle of [90, 22.5, -45]) {
  test(`conic ${angle} degrees agrees between ordinary fill, filter input and native Canvas`, async ({
    page,
  }) => {
    const result = await page.evaluate(
      (angle) => window.gradientGeometryTest.conic(angle),
      angle,
    );
    expect(result).toEqual({ first: 0, filter: 0, cached: 0, opaque: 6400 });
  });
}

test('renders an uppercase radial gradient with a center outside the bounds', async ({
  page,
}) => {
  expect(await page.evaluate(() => window.gradientGeometryTest.radial())).toBe(
    0,
  );
});
