import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type {} from './fixtures/ecs-filter-chain';
import type {
  RectSerializedNode,
  PathSerializedNode,
  EllipseSerializedNode,
} from '../../packages/ecs/src';

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /WebGL|uniform|shader/i.test(message.text())
    )
      errors.push(message.text());
  });
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

function shape(
  type: 'rect' | 'ellipse' | 'path',
): RectSerializedNode | PathSerializedNode | EllipseSerializedNode {
  return {
    id: 'shape',
    type,
    x: 40,
    y: 40,
    width: 60,
    height: 60,
    zIndex: 0,
    ...(type === 'path' ? { d: 'M0 0H60V60H0Z' } : {}),
    fills: [{ type: 'solid', value: 'rgba(0,0,255,0.5)' }],
    strokes: [],
    filter: 'blur(6px, 3)',
    opacity: 1,
  };
}
async function ready(page: Page) {
  await page.goto('/ecs-filter-chain.html');
  await expect(page.locator('#status')).toHaveText('Ready');
}
function close(actual: number[], expected: number[]) {
  for (let c = 0; c < 4; c++)
    expect(
      Math.abs(actual[c] - expected[c]),
      JSON.stringify({ actual, expected }),
    ).toBeLessThanOrEqual(3);
}

function sample(image: string, x: number, y: number) {
  const png = PNG.sync.read(Buffer.from(image.split(',')[1], 'base64'));
  return [
    ...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4),
  ];
}

for (const type of ['rect', 'ellipse', 'path'] as const) {
  test(`${type} live blur edits release old textures and restore the original outline`, async ({
    page,
  }) => {
    await ready(page);
    let result = await page.evaluate(
      (node) => window.filterChainTest.render(node),
      shape(type),
    );
    const live = result.liveTextures.length;
    for (const radius of [2, 9, 2, 6]) {
      result = await page.evaluate(
        (radius) =>
          window.filterChainTest.update({ filter: `blur(${radius}px, 3)` }),
        radius,
      );
      expect(result.liveTextures.length).toBe(live);
      expect(result.resourceErrors).toEqual([]);
    }
    result = await page.evaluate(() =>
      window.filterChainTest.update({ filter: '' }),
    );
    expect(sample(result.image, 37, 70)).toEqual([0, 0, 0, 0]);
    close(sample(result.image, 70, 70), [0, 0, 255, 128]);
    result = await page.evaluate(() =>
      window.filterChainTest.update({ filter: 'blur(0px)' }),
    );
    expect(sample(result.image, 39, 70)).toEqual([0, 0, 0, 0]);
    close(sample(result.image, 70, 70), [0, 0, 255, 128]);
    result = await page.evaluate(() => window.filterChainTest.clear());
    expect(result.resourceErrors).toEqual([]);
    expect(result.liveTextures.length).toBe(0);
  });

  test(`${type} blur captures gradients and layer opacity before shape opacity`, async ({
    page,
  }) => {
    await ready(page);
    const node = shape(type);
    node.opacity = 0.5;
    node.fills = [
      { type: 'solid', value: 'red' },
      {
        type: 'gradient',
        value: 'linear-gradient(90deg, blue, blue)',
        opacity: 0.5,
      },
    ];
    const result = await page.evaluate(
      (node) => window.filterChainTest.render(node),
      node,
    );
    close(sample(result.image, 70, 70), [128, 0, 128, 128]);
    const edge = sample(result.image, 37, 70);
    expect(edge[3]).toBeGreaterThan(5);
    close(edge, [128, 0, 128, edge[3]]);
    expect(result.resourceErrors).toEqual([]);
  });
}

test('ellipse blur preserves its silhouette and remains visible outside the viewport', async ({
  page,
}) => {
  await ready(page);
  let result = await page.evaluate(
    (node) => window.filterChainTest.render(node),
    shape('ellipse'),
  );
  expect(sample(result.image, 37, 70)[3]).toBeGreaterThan(5);
  expect(sample(result.image, 40, 40)[3]).toBeLessThan(20);
  result = await page.evaluate(() => window.filterChainTest.update({ x: -62 }));
  expect(sample(result.image, 0, 70)[3]).toBeGreaterThan(1);
  expect(result.resourceErrors).toEqual([]);
});

test('compound path blur enters a hole without filling its center', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(
    (node) => window.filterChainTest.render(node),
    {
      ...shape('path'),
      type: 'path' as const,
      x: 30,
      y: 25,
      width: 100,
      height: 100,
      d: 'M0 0H100V100H0Z M25 25H75V75H25Z',
      fillRule: 'evenodd' as const,
    },
  );
  expect(sample(result.image, 57, 75)[3]).toBeGreaterThan(5);
  expect(sample(result.image, 80, 75)).toEqual([0, 0, 0, 0]);
  expect(result.resourceErrors).toEqual([]);
});

for (const type of ['rect', 'path'] as const) {
  test(`${type} zoomed blur keeps saturated color at faint edge pixels`, async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(
      (node) => window.filterChainTest.render(node),
      shape(type),
    );
    const result = await page.evaluate(() => window.filterChainTest.view(2));
    let edgeSamples = 0;
    for (let x = 50; x < 80; x++) {
      const p = sample(result.image, x, 130);
      if (p[3] >= 2) {
        expect(p.slice(0, 3), JSON.stringify({ x, p })).toEqual([0, 0, 255]);
        edgeSamples++;
      }
    }
    expect(edgeSamples).toBeGreaterThan(3);
    expect(result.resourceErrors).toEqual([]);
  });
}

test('WebGL1 blur updates consecutive kernels and preserves rounded silhouettes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      return kind === 'webgl2' ? null : getContext.call(this, kind, ...args);
    } as typeof getContext;
  });
  await ready(page);
  const node = {
    ...shape('rect'),
    type: 'rect' as const,
    cornerRadius: 20,
    filter: 'blur(6px, 3) blur(6px, 3)',
  };
  let result = await page.evaluate(
    (node) => window.filterChainTest.render(node),
    node,
  );
  expect(sample(result.image, 37, 70)[3]).toBeGreaterThan(5);
  expect(sample(result.image, 37, 37)[3]).toBeLessThan(
    sample(result.image, 37, 70)[3],
  );
  result = await page.evaluate(() =>
    window.filterChainTest.update({ filter: 'blur(2px, 1)' }),
  );
  expect(sample(result.image, 32, 70)).toEqual([0, 0, 0, 0]);
  expect(result.resourceErrors).toEqual([]);
});

for (const alignment of ['center', 'inner', 'outer'] as const) {
  test(`SDF blur captures the ${alignment} stroke of a shape without a fill`, async ({
    page,
  }) => {
    await ready(page);
    const result = await page.evaluate(
      (node) => window.filterChainTest.render(node),
      {
        ...shape('rect'),
        fills: [],
        strokes: [{ type: 'solid' as const, value: 'blue' }],
        strokeWidth: 8,
        strokeAlignment: alignment,
      },
    );
    expect(sample(result.image, 37, 70)[3]).toBeGreaterThan(5);
    expect(sample(result.image, 37, 70).slice(0, 3)).toEqual([0, 0, 255]);
    expect(sample(result.image, 70, 70)).toEqual([0, 0, 0, 0]);
    expect(result.resourceErrors).toEqual([]);
    const zero = await page.evaluate(() =>
      window.filterChainTest.update({ filter: 'blur(0px)' }),
    );
    const unfiltered = await page.evaluate(() =>
      window.filterChainTest.update({ filter: '' }),
    );
    expect(zero.image).toBe(unfiltered.image);
    expect(zero.resourceErrors).toEqual([]);
    expect(unfiltered.resourceErrors).toEqual([]);
  });
}

for (const type of ['rect', 'path'] as const) {
  test(`${type} blur extends past its outline without darkening blue`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /WebGL|uniform|shader/i.test(message.text())
      )
        errors.push(message.text());
    });
    await page.goto('/ecs-filter-chain.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const result = await page.evaluate(
      (type) =>
        window.filterChainTest.render({
          id: 'shape',
          type,
          x: 40,
          y: 40,
          width: 60,
          height: 60,
          zIndex: 0,
          ...(type === 'path' ? { d: 'M0 0H60V60H0Z' } : {}),
          fills: [{ type: 'solid', value: 'rgba(0,0,255,0.5)' }],
          strokes: [],
          filter: 'blur(6px, 3)',
        }),
      type,
    );
    const outside = sample(result.image, 37, 70);
    expect(outside[3], JSON.stringify(outside)).toBeGreaterThan(5);
    expect(outside[3]).toBeLessThan(128);
    expect(outside.slice(0, 3)).toEqual([0, 0, 255]);
    expect(sample(result.image, 70, 70)).toEqual([0, 0, 255, 128]);
    expect(sample(result.image, 15, 70)).toEqual([0, 0, 0, 0]);
    expect(result.resourceErrors).toEqual([]);
    expect(errors).toEqual([]);
  });
}
