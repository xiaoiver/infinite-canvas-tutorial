import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/animation-state';
import type { RectSerializedNode } from '../../packages/ecs/src';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
  await page.goto('/animation-state.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.animationStateTest?.dispose());
  expect(errors.get(page)).toEqual([]);
});
const rect = (patch: Partial<RectSerializedNode> = {}): RectSerializedNode => ({
  id: 'shape',
  type: 'rect',
  version: 1,
  zIndex: 0,
  x: 20,
  y: 20,
  width: 100,
  height: 60,
  fills: [{ type: 'solid', value: 'red' }],
  ...patch,
});
const pixels = (image: string) =>
  PNG.sync.read(Buffer.from(image.split(',')[1], 'base64'));
const sample = (image: string, x: number, y: number) => {
  const png = pixels(image),
    offset = (y * png.width + x) * 4;
  return [...png.data.subarray(offset, offset + 4)];
};

test('renders independently scrubbed animation positions on two canvases', async ({
  page,
}) => {
  const shape = rect({
    width: 20,
    height: 20,
    animation: {
      keyframes: [{ x: 20 }, { x: 100 }],
      options: { duration: 1000, fill: 'both' },
    },
  });
  await page.evaluate(async (shape) => {
    await window.animationStateTest.render([shape], 0);
    await window.animationStateTest.render([shape], 1);
    await window.animationStateTest.seek(500, 0);
  }, shape);
  const [left, right] = await page.evaluate(() =>
    window.animationStateTest.seek(750, 1),
  );
  expect(sample(left, 70, 30)).toEqual([255, 0, 0, 255]);
  expect(sample(left, 90, 30)[3]).toBe(0);
  expect(sample(right, 90, 30)).toEqual([255, 0, 0, 255]);
  expect(sample(right, 70, 30)[3]).toBe(0);
});

test('renders animated color and layer opacity in the same frame', async ({
  page,
}) => {
  await page.evaluate(
    (shape) => window.animationStateTest.render([shape]),
    rect({
      fills: [
        { type: 'solid', value: 'green', enabled: false },
        { type: 'solid', value: 'red' },
      ],
      animation: {
        keyframes: [
          { fill: 'red', fillOpacity: 0.2 },
          { fill: 'blue', fillOpacity: 0.6 },
        ],
        options: { duration: 1000, fill: 'both' },
      },
    }),
  );
  const [image] = await page.evaluate(() =>
    window.animationStateTest.seek(500),
  );
  const actual = sample(image, 60, 50);
  [128, 0, 128, 102].forEach((value, index) =>
    expect(Math.abs(actual[index] - value)).toBeLessThanOrEqual(2),
  );
});

for (const [name, paint] of [
  ['nonuniform stops', 'linear-gradient(90deg, red 25%, blue 75%)'],
  [
    'hard stops',
    'linear-gradient(90deg, red 0%, red 40%, blue 40%, blue 100%)',
  ],
]) {
  test(`retains gradient pixels with ${name} when interpolating identical keyframes`, async ({
    page,
  }) => {
    const before = await page.evaluate(
      (shape) => window.animationStateTest.render([shape]),
      rect({
        animation: {
          keyframes: [{ fill: paint }, { fill: paint }],
          options: { duration: 1000, fill: 'both' },
        },
      }),
    );
    const [after] = await page.evaluate(() =>
      window.animationStateTest.seek(500),
    );
    expect(pixels(before).data.equals(pixels(after).data)).toBe(true);
    expect(sample(after, 30, 40)[3]).toBe(255);
  });
}

test('keeps both endpoints of an open path visible halfway through morphing', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.animationStateTest.render([
      {
        id: 'shape',
        type: 'path',
        version: 1,
        zIndex: 0,
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        d: 'M20 20C40 20 80 20 100 20',
        fills: [],
        strokes: [{ type: 'solid', value: 'blue' }],
        strokeWidth: 6,
        animation: {
          keyframes: [
            { d: 'M20 20C40 20 80 20 100 20' },
            { d: 'M20 60C40 60 80 60 100 60' },
          ],
          options: { duration: 1000, fill: 'both' },
        },
      },
    ]),
  );
  const [image] = await page.evaluate(() =>
    window.animationStateTest.seek(500),
  );
  expect(sample(image, 25, 40)).toEqual([0, 0, 255, 255]);
  expect(sample(image, 95, 40)).toEqual([0, 0, 255, 255]);
  expect(sample(image, 60, 20)[3]).toBe(0);
});
