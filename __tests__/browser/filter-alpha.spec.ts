import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type {} from './fixtures/ecs-filter-chain';
import type {
  RectSerializedNode,
  PathSerializedNode,
} from '../../packages/ecs/src';

const errorsByPage = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /WebGL|uniform|shader/i.test(message.text())
    )
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

function pixels(image: string) {
  const png = PNG.sync.read(Buffer.from(image.split(',')[1], 'base64'));
  return (x = 40, y = 40) => {
    const offset = (y * png.width + x) * 4;
    return [...png.data.slice(offset, offset + 4)];
  };
}
function close(actual: number[], expected: readonly number[], label: unknown) {
  for (let c = 0; c < 4; c++)
    expect(
      Math.abs(actual[c] - expected[c]),
      JSON.stringify({ label, actual, expected }),
    ).toBeLessThanOrEqual(3);
}
function shape(
  kind: 'rect' | 'path',
  color: string,
  filter: string,
): RectSerializedNode | PathSerializedNode {
  return {
    id: 'shape',
    type: kind,
    x: 10,
    y: 10,
    zIndex: 0,
    width: 67,
    height: 59,
    ...(kind === 'path' ? { d: 'M0 0H67V59H0Z' } : {}),
    fills: [{ type: 'solid', value: color }],
    strokes: [],
    filter,
  };
}
const adjustments = [
  ['brightness(0.2)', [115, 179, 243, 128]],
  ['brightness(-0.4)', [0, 26, 90, 128]],
  ['contrast(0.5)', [1, 129, 255, 128]],
  ['contrast(-0.5)', [96, 128, 160, 128]],
  ['brightness(0.8) brightness(-0.5)', [128, 128, 128, 128]],
] as const;
for (const kind of ['rect', 'path'] as const) {
  for (const global of [false, true]) {
    test(`${kind} ${
      global ? 'canvas' : 'shape'
    } adjustments preserve translucent colors and clamp between passes`, async ({
      page,
    }) => {
      await page.goto('/ecs-filter-chain.html');
      await expect(page.locator('#status')).toHaveText('Ready');
      for (const [filter, expected] of adjustments) {
        const node = shape(kind, 'rgba(64,128,192,0.5)', global ? '' : filter);
        const result = await page.evaluate(
          ({ node, filter }) => window.filterChainTest.render(node, filter),
          { node, filter: global ? filter : '' },
        );
        const sample = pixels(result.image);
        close(sample(), expected, filter);
        expect(sample(2, 2)).toEqual([0, 0, 0, 0]);
        expect(result.resourceErrors).toEqual([]);
      }
    });
  }
  test(`${kind} adjusts translucent gradient and multi-fill inputs before shape opacity`, async ({
    page,
  }) => {
    await page.goto('/ecs-filter-chain.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const color = 'rgba(64,128,192,0.5)';
    for (const multi of [false, true]) {
      const node = shape(kind, color, 'brightness(0.2)');
      node.fills = [
        {
          type: 'gradient',
          value: `linear-gradient(90deg, ${color}, ${color})`,
        },
      ];
      if (multi) node.fills.unshift({ type: 'solid', value: color });
      node.opacity = 0.5;
      const result = await page.evaluate(
        (node) => window.filterChainTest.render(node),
        node,
      );
      close(pixels(result.image)(), [115, 179, 243, multi ? 96 : 64], {
        multi,
      });
      expect(result.resourceErrors).toEqual([]);
    }
  });
  test(`${kind} hue, noise and halftone strengths do not scale with paint alpha`, async ({
    page,
  }) => {
    await page.goto('/ecs-filter-chain.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    for (const filter of [
      'hue-rotate(90deg)',
      'noise(0.7)',
      'dot(1,5,0)',
      'color-halftone(4)',
    ]) {
      const opaque = await page.evaluate(
        (node) => window.filterChainTest.render(node),
        shape(kind, 'blue', filter),
      );
      const translucent = await page.evaluate(
        (node) => window.filterChainTest.render(node),
        shape(kind, 'rgba(0,0,255,0.5)', filter),
      );
      const a = pixels(opaque.image),
        b = pixels(translucent.image);
      for (const x of [25, 40, 55])
        for (const y of [25, 40, 55])
          close(b(x, y), [...a(x, y).slice(0, 3), 128], { filter, x, y });
      expect(translucent.resourceErrors).toEqual([]);
    }
  });
}

test('WebGL1 updates consecutive color passes and live uniforms', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      if (kind === 'webgl2') return null;
      return getContext.call(this, kind, ...args);
    } as typeof getContext;
  });
  await page.goto('/ecs-filter-chain.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const node = shape(
    'rect',
    'rgba(64,128,192,0.5)',
    'brightness(0.8) brightness(-0.5)',
  );
  let result = await page.evaluate(
    (node) => window.filterChainTest.render(node),
    node,
  );
  close(pixels(result.image)(), [128, 128, 128, 128], 'consecutive brightness');
  result = await page.evaluate(() =>
    window.filterChainTest.update({ filter: 'brightness(0.2) contrast(-0.5)' }),
  );
  close(
    pixels(result.image)(),
    [121, 153, 185, 128],
    'live brightness/contrast',
  );
  expect(result.resourceErrors).toEqual([]);
});
