import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import type { DashCase } from './fixtures/dash';

async function compare(page: Page, options: DashCase) {
  await page.evaluate((options) => window.dashTest.render(options), options);
  await comparePixels(page, options);
}

async function comparePixels(page: Page, options: unknown) {
  const actual = PNG.sync.read(await page.locator('#actual').screenshot());
  const reference = PNG.sync.read(
    await page.locator('#reference').screenshot(),
  );
  let missing = 0;
  let extra = 0;
  let ink = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    if (reference.data[i] < 128) ink++;
    // Compare interiors; the two rasterizers have different edge AA kernels.
    if (actual.data[i] > 235 && reference.data[i] < 20) missing++;
    if (actual.data[i] < 20 && reference.data[i] > 235) extra++;
  }
  expect(ink, 'reference must contain visible paint').toBeGreaterThan(100);
  expect({ missing, extra }, JSON.stringify(options)).toEqual({
    missing: 0,
    extra: 0,
  });
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/dash.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(() => expect(errors).toEqual([]));

for (const cap of ['butt', 'square', 'round'] as const) {
  for (const join of ['miter', 'bevel', 'round'] as const) {
    test(`${cap} dashes and ${join} corners match native stroke across phases`, async ({
      page,
    }) => {
      for (const offset of [0, 5, 10, 15, -7]) {
        await compare(page, {
          points: [
            [100, 50],
            [100, 157],
            [243, 157],
          ],
          dash: [20, 30],
          cap,
          join,
          offset,
        });
      }
    });
  }
  test(`${cap} dashes close without restarting phase or adding endpoint caps`, async ({
    page,
  }) => {
    for (const join of ['miter', 'bevel', 'round'] as const) {
      for (const offset of [0, 13]) {
        await compare(page, {
          points: [
            [100, 50],
            [100, 157],
            [243, 157],
            [243, 50],
          ],
          closed: true,
          dash: [20, 30],
          cap,
          join,
          offset,
        });
      }
    }
  });
}

test('round dashes retain their full width and semicircular ends on straight lines', async ({
  page,
}) => {
  for (const zoom of [0.5, 1, 2]) {
    await compare(page, {
      points: [
        [40, 80],
        [260, 80],
      ],
      dash: [20, 30],
      cap: 'round',
      zoom,
    });
  }
});

test('short round dashes, zero-length dots and overlapping caps match native stroke', async ({
  page,
}) => {
  for (const dash of [
    [2, 10],
    [0, 25],
    [2, 4],
  ] as [number, number][]) {
    await compare(page, {
      points: [
        [100, 50],
        [100, 150],
        [250, 150],
      ],
      dash,
      width: 10,
      cap: 'round',
      join: 'round',
    });
  }
});

test('acute and obtuse corners keep the dash phase', async ({ page }) => {
  for (const points of [
    [
      [50, 50],
      [200, 170],
      [280, 50],
    ],
    [
      [50, 50],
      [200, 170],
      [280, 230],
    ],
    [
      [50, 50],
      [200, 170],
      [80, 170],
    ],
  ] as [number, number][][]) {
    for (const join of ['miter', 'bevel', 'round'] as const) {
      await compare(page, {
        points,
        dash: [20, 30],
        offset: 7,
        cap: 'round',
        join,
      });
    }
  }
});

test('subpixel periods are still dashed', async ({ page }) => {
  await compare(page, {
    points: [
      [20, 60],
      [250, 60],
    ],
    dash: [0.4, 0.6],
    width: 8,
    zoom: 2,
  });
});

test('solid stroke joins remain intact', async ({ page }) => {
  for (const join of ['miter', 'bevel', 'round'] as const) {
    await compare(page, {
      points: [
        [100, 50],
        [100, 150],
        [250, 150],
      ],
      dash: [0, 0],
      cap: 'round',
      join,
    });
  }
});

test('offset animation only updates uniforms and matches native phase', async ({
  page,
}) => {
  const options: DashCase = {
    points: [
      [50, 50],
      [50, 150],
      [250, 150],
    ],
    dash: [20, 30],
    cap: 'round',
    join: 'round',
  };
  await compare(page, options);
  const builds = await page.evaluate(() => window.dashTest.geometryBuilds());
  for (const offset of [-37, -5, 8, 27, 100]) {
    await page.evaluate((offset) => window.dashTest.offset(offset), offset);
    await comparePixels(page, { ...options, offset });
  }
  expect(await page.evaluate(() => window.dashTest.geometryBuilds())).toBe(
    builds,
  );
});

test('independent subpaths restart the dash pattern without connecting across gaps', async ({
  page,
}) => {
  await compare(page, {
    points: [
      [50, 50],
      [163, 50],
      [NaN, NaN],
      [50, 150],
      [263, 150],
    ],
    dash: [20, 30],
    cap: 'round',
  });
});

test('aligned straight strokes preserve dash width and caps', async ({
  page,
}) => {
  for (const alignment of ['inner', 'outer'] as const) {
    await compare(page, {
      points: [
        [50, 100],
        [250, 100],
      ],
      dash: [20, 30],
      cap: 'round',
      alignment,
    });
  }
});

test('rectangle dashes share the closed path phase and joins', async ({
  page,
}) => {
  for (const cap of ['butt', 'square', 'round'] as const) {
    await compare(page, {
      points: [
        [100, 50],
        [243, 50],
        [243, 157],
        [100, 157],
      ],
      rect: true,
      closed: true,
      dash: [20, 30],
      offset: 13,
      cap,
      join: 'round',
    });
  }
});
