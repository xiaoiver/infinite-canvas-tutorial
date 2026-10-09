import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type {} from './fixtures/brush';

type Sample = { x: number; y: number; time: number; pressure?: number };
const settle = (page: Page) => page.evaluate(() => window.brushTest.settle());
async function events(
  page: Page,
  samples: Sample[],
  type = 'mouse',
  batched = false,
  end = 'pointerup',
) {
  // Control event timestamps rather than relying on wall-clock sleeps or the
  // software renderer's frame rate. Events still use the real DOM input path.
  await page.evaluate(
    async ({ samples, type, batched, end }) => {
      const canvas = document.querySelector('canvas')!;
      const box = canvas.getBoundingClientRect();
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const phase =
          i === 0
            ? 'pointerdown'
            : i === samples.length - 1
            ? end
            : 'pointermove';
        const event = new PointerEvent(phase, {
          clientX: box.x + s.x,
          clientY: box.y + s.y,
          pointerId: 1,
          pointerType: type,
          isPrimary: true,
          button: 0,
          buttons: phase === 'pointerup' ? 0 : 1,
          pressure: phase === 'pointerup' ? 0 : s.pressure ?? 0.5,
          bubbles: true,
        });
        Object.defineProperty(event, 'timeStamp', { value: s.time });
        canvas.dispatchEvent(event);
        if (!batched) await window.brushTest.settle();
      }
      await window.brushTest.settle();
    },
    { samples, type, batched, end },
  );
}
const line = (interval: number, y = 80): Sample[] => [
  ...Array.from({ length: 21 }, (_, i) => ({
    x: 40 + i * 12,
    y,
    time: i * interval,
  })),
  { x: 280, y, time: 21 * interval },
];
const points = (value: string) =>
  value.split(' ').map((p) => p.split(',').map(Number));
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/brush.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.brushTest.destroy());
  expect(errors).toEqual([]);
});

test('slow and fast mouse strokes differ in stored radii and visible width', async ({
  page,
}) => {
  await events(page, line(80));
  await page.evaluate(() => window.brushTest.activate());
  await events(page, line(6, 180));
  const nodes = await page.evaluate(() => window.brushTest.nodes());
  expect(nodes).toHaveLength(2);
  const slow = points(nodes[0].points),
    fast = points(nodes[1].points);
  expect(slow.at(-1)![2]).toBeGreaterThan(fast.at(-1)![2] * 1.5);
  expect([nodes[0].x + slow.at(-1)![0], nodes[0].y + slow.at(-1)![1]]).toEqual([
    280, 80,
  ]);
  expect([nodes[1].x + fast.at(-1)![0], nodes[1].y + fast.at(-1)![1]]).toEqual([
    280, 180,
  ]);
  await page.evaluate(() => window.brushTest.activate()); // Hide transformer before measuring pixels.
  const url = await page
    .locator('canvas')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const widthAt = (y: number) =>
    Array.from({ length: 70 }, (_, i) => y - 35 + i).filter(
      (py) => png.data[(py * png.width + 220) * 4 + 3] > 128,
    ).length;
  expect(widthAt(80)).toBeGreaterThan(widthAt(180) * 1.4);
  expect(widthAt(180)).toBeGreaterThan(4);
});

test('batched events keep the full stroke, history and screen-space speed across zoom', async ({
  page,
}) => {
  await events(page, line(12), 'mouse', true);
  const first = (await page.evaluate(() => window.brushTest.nodes()))[0];
  const original = points(first.points);
  expect(original.length).toBeGreaterThan(10);
  await page.evaluate(() => window.brushTest.undo());
  expect(await page.evaluate(() => window.brushTest.nodes())).toEqual([]);
  await page.evaluate(() => window.brushTest.redo());
  expect((await page.evaluate(() => window.brushTest.nodes()))[0].points).toBe(
    first.points,
  );
  await page.evaluate(() => window.brushTest.activate(2));
  await events(page, line(12, 160), 'mouse', true);
  const node = (await page.evaluate(() => window.brushTest.nodes()))[1];
  const second = points(node.points);
  expect([node.x + second.at(-1)![0], node.y + second.at(-1)![1]]).toEqual([
    140, 80,
  ]);
  expect(second.at(-1)![2]).toBeCloseTo(original.at(-1)![2], 2);
});

test('pen pressure controls width and zero release pressure keeps the final tip', async ({
  page,
}) => {
  for (const [pressure, y] of [
    [0.2, 80],
    [0.8, 180],
  ]) {
    await page.evaluate(() => window.brushTest.activate());
    await events(
      page,
      line(12, y).map((s) => ({ ...s, pressure })),
      'pen',
      true,
    );
  }
  const nodes = await page.evaluate(() => window.brushTest.nodes());
  expect(points(nodes[0].points).at(-1)![2]).toBe(4);
  expect(points(nodes[1].points).at(-1)![2]).toBe(16);
});

test('clicks and cancellation do not commit, and the next touch stroke starts fresh', async ({
  page,
}) => {
  await events(
    page,
    [
      { x: 40, y: 80, time: 0 },
      { x: 40, y: 80, time: 10 },
    ],
    'touch',
    true,
  );
  expect(await page.evaluate(() => window.brushTest.nodes())).toEqual([]);
  await events(page, line(12), 'touch', false, 'pointercancel');
  expect(await page.evaluate(() => window.brushTest.nodes())).toEqual([]);
  expect(await page.evaluate(() => window.brushTest.previews())).toEqual([]);
  await events(page, line(80, 180), 'touch', true);
  const node = (await page.evaluate(() => window.brushTest.nodes()))[0];
  expect([
    node.x + points(node.points)[0][0],
    node.y + points(node.points)[0][1],
  ]).toEqual([40, 180]);
  expect(points(node.points).at(-1)![2]).toBeGreaterThan(13);
  await settle(page);
});

test('stamp strokes retain speed variation and Escape cancels the live preview', async ({
  page,
}) => {
  await page.evaluate(() => window.brushTest.stamp());
  const samples = line(80);
  // Accelerate halfway through this stroke, keeping coordinates equally spaced.
  for (let i = 11; i < samples.length; i++)
    samples[i].time = 800 + (i - 10) * 6;
  await events(page, samples, 'mouse', true);
  const node = (await page.evaluate(() => window.brushTest.nodes()))[0];
  expect(node.brushType).toBe('stamp');
  expect(node.brushStamp).toContain('stamp1.png');
  const radii = points(node.points).map((p) => p[2]);
  expect(Math.max(...radii)).toBeGreaterThan(radii.at(-1)! * 1.5);
  await page.evaluate(() => window.brushTest.stamp());
  await expect
    .poll(async () => {
      const url = await page
        .locator('canvas')
        .evaluate((c: HTMLCanvasElement) => c.toDataURL());
      const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
      let ink = 0;
      for (let y = 50; y < 110; y++) {
        for (let x = 80; x < 260; x++) {
          if (png.data[(y * png.width + x) * 4 + 3] > 128) ink++;
        }
      }
      return ink;
    })
    .toBeGreaterThan(100);
  await events(page, line(12, 180), 'mouse', true, 'pointermove');
  expect((await page.evaluate(() => window.brushTest.previews())).length).toBe(
    1,
  );
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.evaluate(() => window.brushTest.previews())).toEqual([]);
  expect(await page.evaluate(() => window.brushTest.nodes())).toHaveLength(1);
});
