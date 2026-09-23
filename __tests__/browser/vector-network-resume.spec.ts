import { expect, test, type Page } from '@playwright/test';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { Pen } from '../../packages/ecs/src/components/Canvas';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const seed = (): VectorNetworkSerializedNode => ({
  id: 'resume',
  type: 'vector-network',
  version: 1,
  x: 40,
  y: 30,
  width: 140,
  height: 100,
  zIndex: 1,
  vertices: [
    { x: 0, y: 80 },
    { x: 70, y: 80 },
    { x: 140, y: 80 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ],
  regions: [],
  fills: [],
  strokes: [{ type: 'solid', value: '#333' }],
  strokeWidth: 2,
});
const nodes = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes as VectorNetworkSerializedNode[],
  );
const node = async (page: Page) =>
  (await nodes(page)).find((n) => n.id === 'resume')!;
async function frame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}
async function point(page: Page, p: [number, number]) {
  return page.evaluate(
    (p) => window.canvasRegression.viewportPoint('left', 'resume', p),
    p,
  );
}
async function move(page: Page, p: { x: number; y: number }) {
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + p.x, box.y + p.y);
  await frame(page);
}
async function press(page: Page, p: { x: number; y: number }) {
  await move(page, p);
  await page.mouse.down();
  await frame(page);
}
async function release(page: Page) {
  await page.mouse.up();
  await frame(page);
}
async function click(page: Page, p: { x: number; y: number }) {
  await press(page, p);
  await release(page);
}
async function prepare(page: Page, n = seed()) {
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    n,
  );
  await page.evaluate(() =>
    window.canvasRegression.setPen('left', 'vector-network' as Pen),
  );
  await frame(page);
}
async function anchors(page: Page) {
  return Promise.all(
    (await node(page)).vertices.map((v) => point(page, [v.x, v.y])),
  );
}
function close(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tolerance = 1.5,
) {
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(tolerance);
}
async function history(
  page: Page,
  before: VectorNetworkSerializedNode,
  after: VectorNetworkSerializedNode,
) {
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect
    .poll(() => node(page).then((n) => [n.vertices, n.segments, n.regions]))
    .toEqual([before.vertices, before.segments, before.regions]);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect
    .poll(() => node(page).then((n) => [n.vertices, n.segments, n.regions]))
    .toEqual([after.vertices, after.segments, after.regions]);
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

for (const transformed of [false, true])
  test(`resumes a cubic at an existing endpoint, transformed=${transformed}`, async ({
    page,
  }) => {
    const n = seed();
    if (transformed)
      Object.assign(n, {
        x: 230,
        y: 100,
        rotation: 0.45,
        scaleX: -1,
        scaleY: 0.75,
      });
    await prepare(page, n);
    const before = await node(page),
      fixed = await anchors(page);
    const from = fixed[2],
      target = await point(page, [170, 10]);
    await move(page, from);
    await expect(
      page.locator('[data-vector-network-pen-preview] circle[r="5"]'),
    ).toBeVisible();
    await press(page, from);
    await move(page, { x: from.x + 15, y: from.y - 20 });
    await release(page);
    expect(await node(page)).toEqual(before);
    await press(page, target);
    await move(page, { x: target.x + 20, y: target.y - 10 });
    const preview = await page
      .locator('[data-pen-part="curve"]')
      .getAttribute('d');
    await release(page);
    const after = await node(page),
      positions = await anchors(page);
    expect(await nodes(page)).toHaveLength(1);
    expect(after.vertices).toHaveLength(4);
    expect(after.segments).toHaveLength(3);
    fixed.forEach((p, i) => close(positions[i], p, 0.01));
    close(positions[3], target);
    expect(after.segments.slice(0, 2)).toEqual(before.segments);
    const s = after.segments[2],
      a = after.vertices[s.start],
      b = after.vertices[s.end];
    const controls = [
      positions[s.start],
      await point(page, [a.x + s.tangentStart!.x, a.y + s.tangentStart!.y]),
      await point(page, [b.x + s.tangentEnd!.x, b.y + s.tangentEnd!.y]),
      positions[s.end],
    ];
    const values = preview!
      .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!
      .map(Number);
    controls.forEach((p, i) =>
      close(p, { x: values[i * 2], y: values[i * 2 + 1] }, 0.02),
    );
    await history(page, before, after);
  });

test('branches from a shared vertex without duplicating it', async ({
  page,
}) => {
  await prepare(page);
  const before = await node(page),
    fixed = await anchors(page);
  await click(page, fixed[1]);
  await click(page, await point(page, [70, 10]));
  const after = await node(page),
    positions = await anchors(page);
  expect(after.vertices).toHaveLength(4);
  expect(after.segments[2]).toEqual({ start: 1, end: 3 });
  fixed.forEach((p, i) => close(positions[i], p, 0.01));
  expect(after.segments.slice(0, 2)).toEqual(before.segments);
  await page.screenshot({ path: test.info().outputPath('branch.png') });
  await history(page, before, after);
});

test('connecting to vertex zero preserves existing handles, fill and hole boundaries', async ({
  page,
}) => {
  const n = seed();
  n.vertices = [
    { x: 0, y: 0 },
    { x: 160, y: 0 },
    { x: 160, y: 140 },
    { x: 0, y: 140 },
    { x: 60, y: 50 },
    { x: 100, y: 50 },
    { x: 100, y: 90 },
    { x: 60, y: 90 },
  ];
  n.segments = [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
    { start: 4, end: 5 },
    { start: 5, end: 6 },
    { start: 6, end: 7 },
    { start: 7, end: 4 },
  ];
  n.regions = [
    {
      fillRule: 'evenodd',
      loops: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
    },
  ];
  n.fills = [{ type: 'solid', value: '#e5484d' }];
  await prepare(page, n);
  const before = await node(page);
  await click(page, await point(page, [160, 0]));
  await click(page, await point(page, [30, 20]));
  const intermediate = await node(page),
    p = await point(page, [0, 0]);
  await press(page, p);
  await move(page, { x: p.x - 15, y: p.y - 15 });
  await release(page);
  const after = await node(page);
  expect(after.vertices).toHaveLength(9);
  expect(after.segments).toHaveLength(10);
  expect(after.segments.slice(0, 8)).toEqual(before.segments);
  expect(after.regions).toEqual(before.regions);
  expect(after.fills).toEqual(before.fills);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('left')!.state.penbarSelected,
    ),
  ).toBe('select');
  await history(page, intermediate, after);
});

for (const cancel of ['Escape', 'pointercancel', 'tool'])
  test(`cancels a resumed first anchor through ${cancel} without document writes`, async ({
    page,
  }) => {
    await prepare(page);
    const before = await node(page),
      p = await point(page, [140, 80]);
    await press(page, p);
    await move(page, { x: p.x + 20, y: p.y - 20 });
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else if (cancel === 'pointercancel')
      await page
        .locator('#left canvas')
        .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
    else
      await page.evaluate(() =>
        window.canvasRegression.setPen('left', 'select' as Pen),
      );
    await frame(page);
    await release(page);
    expect(await node(page)).toEqual(before);
    if (cancel === 'pointercancel') {
      await click(page, { x: 240, y: 170 });
      await click(page, { x: 270, y: 180 });
      expect(await nodes(page)).toHaveLength(2);
      expect(await node(page)).toEqual(before);
    }
  });

test('starting away from the selected network creates a separate node', async ({
  page,
}) => {
  await prepare(page);
  const before = await node(page);
  await click(page, { x: 200, y: 160 });
  await click(page, { x: 260, y: 170 });
  expect(await nodes(page)).toHaveLength(2);
  expect(await node(page)).toEqual(before);
});

test('undo during a resumed pending edge abandons the stale continuation', async ({
  page,
}) => {
  await prepare(page);
  const before = await node(page);
  await click(page, await point(page, [70, 80]));
  await click(page, await point(page, [70, 20]));
  await press(page, { x: 210, y: 60 });
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  await release(page);
  const after = await node(page);
  expect(after.vertices).toEqual(before.vertices);
  expect(after.segments).toEqual(before.segments);
  await click(page, { x: 230, y: 170 });
  await click(page, { x: 270, y: 170 });
  expect(await nodes(page)).toHaveLength(2);
  expect((await node(page)).segments).toEqual(before.segments);
});

for (const unavailable of ['locked', 'hidden', 'collapsed'])
  test(`does not resume a ${unavailable} network`, async ({ page }) => {
    const n = seed();
    if (unavailable === 'locked') n.locked = true;
    else if (unavailable === 'hidden') n.visibility = 'hidden';
    else n.scaleX = 0;
    await prepare(page, n);
    const before = await node(page);
    await click(page, await point(page, [140, 80]));
    await click(page, { x: 260, y: 170 });
    expect(await nodes(page)).toHaveLength(2);
    expect(await node(page)).toEqual(before);
  });

test('retracing an existing straight edge does not duplicate it or alter history', async ({
  page,
}) => {
  await prepare(page);
  const before = await node(page);
  await click(page, await point(page, [70, 80]));
  await click(page, await point(page, [0, 80]));
  expect(await node(page)).toEqual(before);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('left')!.state.penbarSelected,
    ),
  ).toBe('select');
});
