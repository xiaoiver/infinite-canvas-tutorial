import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type {} from './fixtures/ecs-filter-chain';
import type {
  RectSerializedNode,
  PathSerializedNode,
} from '../../packages/ecs/src';

function pixel(url: string, x = 40, y = 40) {
  const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  return [
    ...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
  ];
}
const shape = (
  kind: 'rect' | 'path',
  fills: RectSerializedNode['fills'],
): RectSerializedNode | PathSerializedNode => ({
  id: 'shape',
  type: kind,
  x: 10,
  y: 10,
  zIndex: 0,
  width: 67,
  height: 59,
  ...(kind === 'path' ? { d: 'M0 0H67V59H0Z' } : {}),
  fills,
  strokes: [],
  filter: 'brightness(0) contrast(0)',
});
for (const kind of ['rect', 'path'] as const) {
  for (const gradient of [false, true]) {
    test(`${kind} identity filter preserves both ${
      gradient ? 'gradient' : 'solid'
    } fill layers`, async ({ page }) => {
      await page.goto('/ecs-filter-chain.html');
      await expect(page.locator('#status')).toHaveText('Ready');
      const result = await page.evaluate(
        (node) => window.filterChainTest.render(node),
        shape(kind, [
          { type: 'solid', value: 'red' },
          {
            type: gradient ? 'gradient' : 'solid',
            value: gradient ? 'linear-gradient(90deg, blue, blue)' : 'blue',
            opacity: 0.5,
          },
        ]),
      );
      const actual = pixel(result.image);
      for (const [i, expected] of [128, 0, 128, 255].entries())
        expect(
          Math.abs(actual[i] - expected),
          JSON.stringify(actual),
        ).toBeLessThanOrEqual(2);
      expect(result.resourceErrors).toEqual([]);
    });
  }
}

function expectPixel(image: string, expected: number[], x = 40, y = 40) {
  const actual = pixel(image, x, y);
  for (let c = 0; c < 4; c++)
    expect(
      Math.abs(actual[c] - expected[c]),
      JSON.stringify({ actual, expected, x, y }),
    ).toBeLessThanOrEqual(3);
}
for (const kind of ['rect', 'path'] as const) {
  test(`${kind} filters run after fill composition and retain effect order`, async ({
    page,
  }) => {
    await page.goto('/ecs-filter-chain.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const node = shape(kind, [
      { type: 'solid', value: 'rgb(64,64,64)' },
      {
        type: 'gradient',
        value: 'linear-gradient(90deg, rgb(192,192,192), rgb(192,192,192))',
        opacity: 0.5,
      },
    ]);
    node.filter = 'brightness(0.1) contrast(0.5)';
    let result = await page.evaluate(
      (node) => window.filterChainTest.render(node),
      node,
    );
    expectPixel(result.image, [180, 180, 180, 255]);
    result = await page.evaluate(() =>
      window.filterChainTest.update({
        filter: 'contrast(0.5) brightness(0.1)',
      }),
    );
    expectPixel(result.image, [154, 154, 154, 255]);
    expect(result.resourceErrors).toEqual([]);
  });

  test(`${kind} preserves paint alpha, layer opacity, blend modes and shape opacity`, async ({
    page,
  }) => {
    await page.goto('/ecs-filter-chain.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    for (const blendMode of ['normal', 'multiply'] as const) {
      const node = shape(kind, [
        { type: 'solid', value: 'rgba(220,100,80,0.6)', opacity: 0.8 },
        {
          type: 'gradient',
          value:
            'linear-gradient(90deg, rgba(80,140,220,0.5), rgba(80,140,220,0.5))',
          opacity: 0.8,
          blendMode,
        },
      ]);
      node.opacity = 0.6;
      const expected = await page.evaluate((mode) => {
        const paint = document.createElement('canvas');
        paint.width = paint.height = 1;
        const p = paint.getContext('2d')!;
        p.fillStyle = 'rgba(220,100,80,0.6)';
        p.globalAlpha = 0.8;
        p.fillRect(0, 0, 1, 1);
        p.globalCompositeOperation = mode === 'normal' ? 'source-over' : mode;
        p.fillStyle = 'rgba(80,140,220,0.5)';
        p.fillRect(0, 0, 1, 1);
        const out = document.createElement('canvas');
        out.width = out.height = 1;
        const o = out.getContext('2d')!;
        o.globalAlpha = 0.6;
        o.drawImage(paint, 0, 0);
        return [...o.getImageData(0, 0, 1, 1).data];
      }, blendMode);
      const result = await page.evaluate(
        (node) => window.filterChainTest.render(node),
        node,
      );
      expectPixel(result.image, expected);
      expect(result.resourceErrors).toEqual([]);
    }
  });

  test(`${kind} live edits release superseded textures and recover after filter removal`, async ({
    page,
  }) => {
    await page.goto('/ecs-filter-chain.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const node = shape(kind, [
      { type: 'solid', value: 'red' },
      { type: 'solid', value: 'blue', opacity: 0.5 },
    ]);
    const live = (result: { liveTextures: number[][] }) =>
      result.liveTextures.filter(([w, h]) => w === 67 && h === 59).length;
    let result = await page.evaluate(
      (node) => window.filterChainTest.render(node),
      node,
    );
    expect(live(result)).toBe(3);
    for (let i = 0; i < 3; i++) {
      result = await page.evaluate(() =>
        window.filterChainTest.update({ filter: 'brightness(0) contrast(0)' }),
      );
      expectPixel(result.image, [128, 0, 128, 255]);
      expect(live(result)).toBe(3);
      result = await page.evaluate(() =>
        window.filterChainTest.update({ filter: undefined }),
      );
      expectPixel(result.image, [128, 0, 128, 255]);
      expect(live(result)).toBe(0);
    }
    result = await page.evaluate(() =>
      window.filterChainTest.update({
        fills: [{ type: 'solid', value: 'lime' }],
      }),
    );
    expectPixel(result.image, [0, 255, 0, 255]);
    expect(live(result)).toBe(1);
    result = await page.evaluate(() => window.filterChainTest.clear());
    expect(live(result)).toBe(0);
    expect(result.resourceErrors).toEqual([]);
  });
}

test('filtered compound paths retain holes after geometry and fill-rule edits', async ({
  page,
}) => {
  await page.goto('/ecs-filter-chain.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const node = shape('path', [
    { type: 'solid', value: 'red' },
    { type: 'solid', value: 'blue', opacity: 0.5 },
  ]);
  Object.assign(node, {
    d: 'M0 0H67V59H0Z M20 20H50V45H20Z',
    fillRule: 'evenodd',
  });
  let result = await page.evaluate(
    (node) => window.filterChainTest.render(node),
    node,
  );
  expectPixel(result.image, [128, 0, 128, 255], 20, 20);
  expectPixel(result.image, [0, 0, 0, 0], 40, 40);
  result = await page.evaluate(() =>
    window.filterChainTest.update({ fillRule: 'nonzero' }),
  );
  expectPixel(result.image, [128, 0, 128, 255]);
  result = await page.evaluate(() =>
    window.filterChainTest.update({ d: 'M0 0H40V59H0Z' }),
  );
  expectPixel(result.image, [0, 0, 0, 0], 60, 40);
  expectPixel(result.image, [128, 0, 128, 255], 30, 40);
  expect(result.resourceErrors).toEqual([]);
});
