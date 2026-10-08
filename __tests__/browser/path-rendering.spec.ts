import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';

test.setTimeout(60000);

async function compare(page: Page) {
  const actual = PNG.sync.read(
    await page.locator('#actual').screenshot({ scale: 'css' }),
  );
  const reference = PNG.sync.read(
    await page.locator('#reference').screenshot({ scale: 'css' }),
  );
  let different = 0,
    ink = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    if (reference.data[i] < 128) ink++;
    if (Math.abs(actual.data[i] - reference.data[i]) > 128) different++;
  }
  expect(ink).toBeGreaterThan(500);
  // Allow different AA kernels, but reject the multi-pixel facets of fixed sampling.
  expect(different).toBeLessThan(200);
}

async function expectUniformStrokeInterior(page: Page) {
  const actual = PNG.sync.read(
    await page.locator('#actual').screenshot({ scale: 'css' }),
  );
  const reference = PNG.sync.read(
    await page.locator('#reference').screenshot({ scale: 'css' }),
  );
  let interiorPixels = 0;
  let defects = 0;
  for (let y = 2; y < actual.height - 2; y++) {
    for (let x = 2; x < actual.width - 2; x++) {
      const i = (y * actual.width + x) * 4;
      if (reference.data[i] > 130) continue;
      // Erode the native stroke by two pixels to exclude its external AA edge.
      let interior = true;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const neighbor = ((y + dy) * actual.width + x + dx) * 4;
          if (reference.data[neighbor] !== reference.data[i]) interior = false;
        }
      }
      if (!interior) continue;
      interiorPixels++;
      // Detect light cracks and dark double blending, allowing only rounding.
      if (
        [0, 1, 2].some(
          (c) => Math.abs(actual.data[i + c] - reference.data[i + c]) > 3,
        )
      )
        defects++;
    }
  }
  expect(interiorPixels).toBeGreaterThan(20000);
  expect(defects).toBe(0);
}

for (const engine of ['ecs', 'core']) {
  test.describe(`${engine} adaptive path rendering`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${engine}-path-rendering.html`);
      await expect(page.locator('#status')).toHaveText('Ready', {
        timeout: 20000,
      });
    });
    for (const fill of [true, false]) {
      for (const parentScale of [1, -2]) {
        test(`${
          fill ? 'fill' : 'stroke'
        } matches native curves at 1–64x with parent scale ${parentScale}`, async ({
          page,
        }) => {
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.evaluate((options) => window.pathTest.render(options), {
            d: 'M0 100 C0 -80 200 -80 200 100' + (fill ? ' Z' : ''),
            fill,
            parentScale,
          });
          const before = await page.evaluate(() => window.pathTest.state());
          for (const zoom of [1, 8, 64]) {
            await page.evaluate((zoom) => window.pathTest.zoom(zoom), zoom);
            await compare(page);
            expect(
              (await page.evaluate(() => window.pathTest.state())).bounds,
            ).toEqual(before.bounds);
          }
          const after = await page.evaluate(() => window.pathTest.state());
          expect(after.vertices).toBeGreaterThan(before.vertices);
          expect(errors).toEqual([]);
        });
      }
    }
    test('reuses GPU geometry while panning and zooming within a precision bucket', async ({
      page,
    }) => {
      await page.evaluate(() =>
        window.pathTest.render({
          d: 'M0 100 C0 -80 200 -80 200 100 Z',
          fill: true,
          parentScale: 1,
        }),
      );
      await page.evaluate(() => window.pathTest.zoom(8.5));
      const before = await page.evaluate(() => window.pathTest.state());
      for (const zoom of [8.6, 8.4, 8.8]) {
        await page.evaluate((zoom) => window.pathTest.zoom(zoom, 1), zoom);
        expect(
          (await page.evaluate(() => window.pathTest.state())).builds,
        ).toBe(before.builds);
      }
    });

    test('ellipse arcs and quadratic commands stay smooth across zoom levels', async ({
      page,
    }) => {
      for (const d of [
        'M0 100 A100 135 0 0 1 200 100',
        'M0 100 Q100 -170 200 100',
      ]) {
        await page.evaluate(
          (d) => window.pathTest.render({ d, fill: false, parentScale: 1 }),
          d,
        );
        for (const zoom of [1, 16, 64]) {
          await page.evaluate((zoom) => window.pathTest.zoom(zoom), zoom);
          await compare(page);
        }
      }
    });

    test('retains thin edges at high zoom and DPR 3', async ({ page }) => {
      await page.goto(`/${engine}-path-rendering.html?dpr=3`);
      await expect(page.locator('#status')).toHaveText('Ready', {
        timeout: 20000,
      });
      await page.evaluate(() =>
        window.pathTest.render({
          d: 'M0 100 C0 -80 200 -80 200 100',
          fill: false,
          parentScale: 1,
        }),
      );
      await page.evaluate(() => window.pathTest.zoom(64));
      await compare(page);
    });

    for (const lineJoin of ['miter', 'round', 'bevel'] as const) {
      test(`has no internal cracks or overdraw with ${lineJoin} joins`, async ({
        page,
      }) => {
        // Multiple GPU readbacks can be slow on software-rendered CI workers.
        test.setTimeout(120000);
        for (const opacity of [1, 0.5]) {
          await page.evaluate((options) => window.pathTest.render(options), {
            d: 'M0 100 C0 -80 200 -80 200 100',
            fill: false,
            parentScale: 1,
            lineJoin,
            opacity,
          });
          await page.evaluate(() => window.pathTest.zoom(64));
          await expectUniformStrokeInterior(page);
        }
      });
    }

    test('keeps mirrored high-DPI arc joins uniform across precision levels', async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.goto(`/${engine}-path-rendering.html?dpr=3`);
      await expect(page.locator('#status')).toHaveText('Ready', {
        timeout: 20000,
      });
      await page.evaluate(() =>
        window.pathTest.render({
          d: 'M0 100 A100 135 0 0 1 200 100',
          fill: false,
          parentScale: -2,
          opacity: 0.5,
          strokeWidth: 3,
          lineJoin: 'round',
        }),
      );
      for (const zoom of [32, 64]) {
        await page.evaluate((zoom) => window.pathTest.zoom(zoom), zoom);
        await expectUniformStrokeInterior(page);
      }
    });
  });
}
