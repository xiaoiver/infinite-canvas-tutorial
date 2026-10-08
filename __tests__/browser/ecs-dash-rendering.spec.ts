import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import { compare, registerDashRenderingTests } from './dash-rendering-cases';
import type { EcsDashCase } from './fixtures/ecs-dash';
// ECS currently invalidates geometry for every Stroke write. This suite checks
// the existing API update path without asserting lesson 12's uniform-only path.
registerDashRenderingTests('/ecs-dash.html', false);
test.setTimeout(60000);

test('screen-space strokes keep dash and cap sizes across camera zooms', async ({
  page,
}) => {
  for (const zoom of [0.5, 1, 2]) {
    const options: EcsDashCase = {
      points: [
        [50, 50],
        [50, 150],
        [250, 150],
      ],
      dash: [20, 30],
      offset: 7,
      cap: 'round',
      join: 'round',
      zoom,
      attenuation: true,
    };
    await compare(page, options);
  }
});

test('path endpoint caps are independent of internal dash caps', async ({
  page,
}) => {
  for (const linecap of ['butt', 'square', 'round'] as const) {
    for (const cap of ['butt', 'square', 'round'] as const) {
      const options: EcsDashCase = {
        points: [
          [50, 100],
          [260, 100],
        ],
        dash: [20, 30],
        linecap,
        cap,
      };
      await compare(page, options);
    }
  }
});

test('gradient strokes retain dash coverage and color', async ({ page }) => {
  const options: EcsDashCase = {
    points: [
      [50, 50],
      [50, 150],
      [250, 150],
    ],
    dash: [20, 30],
    cap: 'round',
    join: 'round',
    gradient: true,
  };
  await compare(page, options);
  const pixels = PNG.sync.read(await page.locator('#actual').screenshot()).data;
  const blues: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] < 20 && pixels[i + 1] < 20) blues.push(pixels[i + 2]);
  }
  expect(Math.max(...blues) - Math.min(...blues)).toBeGreaterThan(100);
});

test('paths and vector networks share continuous dash phase at corners', async ({
  page,
}) => {
  for (const kind of ['path', 'vector-network'] as const) {
    const options: EcsDashCase = {
      points: [
        [50, 50],
        [50, 150],
        [250, 150],
      ],
      dash: [20, 30],
      offset: 7,
      cap: 'round',
      join: 'round',
      kind,
    };
    await compare(page, options);
  }
});

test('sampled circle and ellipse strokes keep their seam and dash caps', async ({
  page,
}) => {
  for (const kind of ['circle', 'ellipse'] as const) {
    const rx = kind === 'circle' ? 80 : 100;
    const ry = kind === 'circle' ? 80 : 60;
    const options: EcsDashCase = {
      points: Array.from({ length: 64 }, (_, i) => [
        150 + rx * Math.cos((i / 64) * Math.PI * 2),
        150 + ry * Math.sin((i / 64) * Math.PI * 2),
      ]),
      closed: true,
      dash: [20, 30],
      offset: 7,
      width: 10,
      cap: 'round',
      join: 'round',
      kind,
    };
    await compare(page, options);
  }
});

test('zero-length round dashes route rectangle strokes through the dash renderer', async ({
  page,
}) => {
  await compare(page, {
    points: [
      [100, 50],
      [243, 50],
      [243, 157],
      [100, 157],
    ],
    rect: true,
    closed: true,
    dash: [0, 30],
    cap: 'round',
    width: 10,
  });
});

test('solid arrowhead subpaths preserve endpoint caps and sharp joins', async ({
  page,
}) => {
  for (const cap of ['butt', 'square', 'round'] as const) {
    await compare(page, {
      points: [
        [150, 100],
        [100, 70],
        [150, 40],
        [NaN, NaN],
        [380, 150],
        [410, 200],
        [440, 150],
      ],
      dash: [0, 0],
      cap,
      join: 'miter',
      width: 8,
    });
  }
});
