import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/image-decoding';
import { readFileSync } from 'node:fs';

// Pin the current codec output, not source-color accuracy (see fixture notes).
const heicPixels = [
  [233, 52, 18, 255],
  [12, 86, 234, 255],
];
const pngPixels = [
  [220, 60, 30, 255],
  [25, 90, 220, 255],
];
function expectColors(
  result: { size: number[]; pixels: number[][] },
  pixels = heicPixels,
) {
  expect(result.size).toEqual([64, 32]);
  for (const [i, expected] of pixels.entries()) {
    expect(result.pixels[i][3]).toBe(255);
    for (let c = 0; c < 3; c++)
      expect(Math.abs(result.pixels[i][c] - expected[c])).toBeLessThanOrEqual(
        8,
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
    pngPixels,
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
    expectColors(result.result);
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
