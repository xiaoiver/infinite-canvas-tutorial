import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/image-decoding';
import { readFileSync } from 'node:fs';

// Compare against source colors, allowing only the fixture's lossy encoding.
const sourcePixels = [
  [220, 60, 30, 255],
  [25, 90, 220, 255],
];
function expectColors(
  result: { size: number[]; pixels: number[][] },
  tolerance = 3,
) {
  expect(result.size).toEqual([64, 32]);
  for (const [i, expected] of sourcePixels.entries()) {
    expect(result.pixels[i][3]).toBe(255);
    for (let c = 0; c < 3; c++)
      expect(Math.abs(result.pixels[i][c] - expected[c])).toBeLessThanOrEqual(
        tolerance,
      );
  }
}

test('decodes real HEIC from URLs, Blob, File and base64, and ordinary PNG without File', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/image-decoding.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  expectColors(
    await page.evaluate(() => window.imageDecodingTest.withoutFile()),
    0,
  );
  const { results, inputStillAvailable } = await page.evaluate(() =>
    window.imageDecodingTest.sources(),
  );
  for (const result of results) expectColors(result);
  expect(inputStillAvailable).toBe(true);
  expect(errors).toEqual([]);
});

test('renders JPEG fallback pixels after real PNG conversion and bitmap decoder failures', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/image-decoding.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  for (const failure of ['conversion', 'bitmap'] as const) {
    const result = await page.evaluate(
      (failure) => window.imageDecodingTest.fallback(failure),
      failure,
    );
    expect(result.failed).toBe(true);
    expect(result.encodedTypes).toEqual(['image/png', 'image/jpeg']);
    expect(result.decodedTypes).toEqual(
      failure === 'conversion' ? ['image/jpeg'] : ['image/png', 'image/jpeg'],
    );
    expectColors(result.result, 6);
  }
  expect(errors).toEqual([]);
});

test('retries a failed HEIC request without poisoning subsequent decoding', async ({
  page,
}) => {
  const image = readFileSync(
    '__tests__/browser/fixtures/assets/decoder-colors.heic',
  );
  let requests = 0;
  await page.route('**/retry.heic', (route) => {
    requests++;
    return route.fulfill(
      requests === 1
        ? { status: 503, body: 'temporary failure' }
        : { contentType: 'image/heic', body: image },
    );
  });
  await page.goto('/image-decoding.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(async () => {
      try {
        await window.imageDecodingTest.read('/retry.heic');
      } catch (error) {
        return (error as Error).message;
      }
      return 'unexpected success';
    }),
  ).toContain('503');
  expectColors(
    await page.evaluate(() => window.imageDecodingTest.read('/retry.heic')),
  );
  expect(requests).toBe(2);
});

test('preserves full-range gray levels and alpha when decoding HEIC', async ({
  page,
}) => {
  await page.goto('/image-decoding.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(() =>
    window.imageDecodingTest.read(
      '/assets/decoder-tones.heic',
      Array.from({ length: 8 }, (_, i) => i * 32 + 16),
    ),
  );
  expect(result.size).toEqual([256, 32]);
  for (const [i, gray] of [0, 16, 64, 128, 235, 255].entries()) {
    expect(result.pixels[i][3]).toBe(255);
    for (let c = 0; c < 3; c++)
      expect(Math.abs(result.pixels[i][c] - gray)).toBeLessThanOrEqual(2);
  }
  expect(result.pixels[6][3]).toBe(128);
  for (const [c, color] of [220, 60, 30].entries())
    expect(Math.abs(result.pixels[6][c] - color)).toBeLessThanOrEqual(3);
  // Fully transparent RGB is discarded by canvas; alpha must be retained.
  expect(result.pixels[7]).toEqual([0, 0, 0, 0]);
});

test('returns the first still frame of a multi-image HEIC container', async ({
  page,
}) => {
  await page.goto('/image-decoding.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  expectColors(
    await page.evaluate(() =>
      window.imageDecodingTest.read('/assets/decoder-sequence.heic'),
    ),
  );
});

test('recovers from corrupt HEIC and keeps concurrent worker requests separate', async ({
  page,
}) => {
  await page.goto('/image-decoding.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    let rejected = false;
    try {
      await window.imageDecodingTest.read(
        new Blob(['corrupt image'], { type: 'image/heic' }),
      );
    } catch {
      rejected = true;
    }
    const [colors, tones] = await Promise.all([
      window.imageDecodingTest.read('/assets/decoder-colors.heic'),
      window.imageDecodingTest.read('/assets/decoder-tones.heic'),
    ]);
    return { rejected, colors, tones };
  });
  expect(result.rejected).toBe(true);
  expectColors(result.colors);
  expect(result.tones.size).toEqual([256, 32]);
  expect(result.tones.pixels[0]).toEqual([0, 0, 0, 255]);
  expect(result.tones.pixels[1]).toEqual([16, 16, 16, 255]);
});
