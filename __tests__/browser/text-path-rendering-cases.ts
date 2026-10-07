import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import type { TextPathCase } from './fixtures/text-path';

export function registerTextPathRenderingTests(url: string) {
  let errors: string[];
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await expect(page.locator('#status')).toHaveText(
      url.includes('ecs-') ? 'Path ready' : 'Ready',
      { timeout: 30000 },
    );
  });
  test.afterEach(() => expect(errors).toEqual([]));

  async function pixels(page: Page) {
    const actual = PNG.sync.read(await page.locator('#actual').screenshot());
    const reference = PNG.sync.read(
      await page.locator('#reference').screenshot(),
    );
    let painted = 0,
      expected = 0,
      missing = 0,
      extra = 0;
    for (let i = 0; i < actual.data.length; i += 4) {
      if (actual.data[i] < 128) painted++;
      if (reference.data[i] < 128) expected++;
      if (actual.data[i] > 235 && reference.data[i] < 20) missing++;
      if (actual.data[i] < 20 && reference.data[i] > 235) extra++;
    }
    return { painted, expected, missing, extra };
  }
  async function compare(page: Page, options?: TextPathCase) {
    if (options)
      await page.evaluate(
        (options) => window.textPathTest.render(options),
        options,
      );
    const result = await pixels(page);
    expect(result.expected).toBeGreaterThan(100);
    expect(
      result.painted / result.expected,
      JSON.stringify(result),
    ).toBeGreaterThan(0.8);
    expect(
      result.painted / result.expected,
      JSON.stringify(result),
    ).toBeLessThan(1.2);
    // SDF and native SVG use different antialiasing. Compare dark interiors.
    expect(
      result.missing / result.expected,
      JSON.stringify(result),
    ).toBeLessThan(0.12);
    expect(result.extra / result.expected, JSON.stringify(result)).toBeLessThan(
      0.12,
    );
  }

  for (const textAlign of ['start', 'center', 'end'] as const) {
    test(`${textAlign} text matches SVG on an open curve`, async ({ page }) => {
      await compare(page, { path: 'M50 240C160 65 430 65 585 220', textAlign });
    });
  }
  test('other side reverses travel and orientation while preserving reading order', async ({
    page,
  }) => {
    await compare(page, {
      path: 'M50 240C160 65 430 65 585 220',
      referencePath: 'M585 220C430 65 160 65 50 240',
      side: 'right',
      textAlign: 'center',
    });
  });
  test('spacing, normal displacement and x/y match SVG on a straight path', async ({
    page,
  }) => {
    await compare(page, {
      path: 'M30 100H580',
      textAlign: 'center',
      letterSpacing: 4,
      pathOffset: 35,
      x: 12,
      y: 10,
    });
  });
  test('open path overflow clips at either end without wrapping', async ({
    page,
  }) => {
    await compare(page, { path: 'M80 180H440', startOffset: 270 });
    await compare(page, { path: 'M80 180H440', startOffset: -130 });
    await page.evaluate(() =>
      window.textPathTest.update({ startOffset: 1000 }),
    );
    expect((await pixels(page)).painted).toBe(0);
  });
  test('live path and offset updates refresh rendering and bounds', async ({
    page,
  }) => {
    await compare(page, { path: 'M50 150H590' });
    const before = await page.evaluate(() => window.textPathTest.bounds());
    await page.evaluate(() => window.textPathTest.update({ startOffset: 80 }));
    await compare(page);
    const after = await page.evaluate(() => window.textPathTest.bounds());
    expect(after.minX - before.minX).toBeCloseTo(80, 1);
    await page.evaluate(() =>
      window.textPathTest.update({
        path: 'M300 30V330',
        startOffset: 0,
        content: 'Path',
        pathOffset: 25,
      }),
    );
    await compare(page);
    const changed = await page.evaluate(() => window.textPathTest.bounds());
    expect(changed.maxY - changed.minY).toBeGreaterThan(
      changed.maxX - changed.minX,
    );
  });
  test('closed seams wrap continuously and SVG export preserves glyph transforms', async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.textPathTest.render({
        path: 'M200 165A100 100 0 1 1 400 165A100 100 0 1 1 200 165Z',
        startOffset: -90,
        fontSize: 32,
      }),
    );
    const before = await page.locator('#actual').screenshot();
    await page.evaluate(() => window.textPathTest.exported());
    await compare(page);
    await page.evaluate(() =>
      window.textPathTest.update({ startOffset: -90 + 2 * Math.PI * 100 }),
    );
    const after = await page.locator('#actual').screenshot();
    // Arc-length integration is approximate; a full circle still returns to the same position.
    const a = PNG.sync.read(before),
      b = PNG.sync.read(after);
    let changed = 0;
    for (let i = 0; i < a.data.length; i += 4)
      if (Math.abs(a.data[i] - b.data[i]) > 80) changed++;
    expect(changed).toBeLessThan(20);
  });
  test('MSDF glyphs remain inside updated bounds on either side', async ({
    page,
  }) => {
    for (const side of ['left', 'right'] as const) {
      await page.evaluate(
        (side) =>
          window.textPathTest.render({
            path: 'M60 200Q300 20 580 210',
            textAlign: 'center',
            side,
            fontSize: 38,
            bitmap: true,
          }),
        side,
      );
      const { minX, minY, maxX, maxY } = await page.evaluate(() =>
        window.textPathTest.bounds(),
      );
      const png = PNG.sync.read(await page.locator('#actual').screenshot());
      // Screenshots use device pixels; geometry bounds use document units.
      const scale = png.width / 640;
      let ink = 0,
        outside = 0;
      for (let y = 0; y < png.height; y++)
        for (let x = 0; x < png.width; x++) {
          if (png.data[(y * png.width + x) * 4] >= 80) continue;
          ink++;
          if (
            x / scale < minX - 2 ||
            x / scale > maxX + 2 ||
            y / scale < minY - 2 ||
            y / scale > maxY + 2
          )
            outside++;
        }
      expect(ink).toBeGreaterThan(100);
      expect(outside).toBe(0);
    }
  });
  test('degenerate paths produce finite empty bounds and no paint', async ({
    page,
  }) => {
    await page.evaluate(() =>
      window.textPathTest.render({ path: 'M200 200L200 200' }),
    );
    expect((await pixels(page)).painted).toBe(0);
    expect(await page.evaluate(() => window.textPathTest.bounds())).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    });
  });
}
