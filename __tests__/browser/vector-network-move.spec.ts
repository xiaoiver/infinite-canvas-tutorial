import { expect, test, type Page } from '@playwright/test';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import {
  pointOnVectorCubic,
  vectorSegmentCubic,
} from '../../packages/ecs/src/utils/vector-network-curve';
import type { BrowserHarness } from './fixtures/main';
declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const network = (): VectorNetworkSerializedNode => ({
  id: 'move',
  type: 'vector-network',
  version: 1,
  x: 40,
  y: 30,
  width: 180,
  height: 100,
  zIndex: 1,
  vertices: [
    { x: 0, y: 80 },
    { x: 80, y: 80 },
    { x: 180, y: 80 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ],
  regions: [],
  fills: [],
  strokes: [{ type: 'solid', value: '#000' }],
  strokeWidth: 2,
});
const node = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes[0] as VectorNetworkSerializedNode,
  );
async function frame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}
async function position(page: Page, point: [number, number]) {
  const p = await page.evaluate(
    (p) => window.canvasRegression.viewportPoint('left', 'move', p),
    point,
  );
  const b = (await page.locator('#left canvas').boundingBox())!;
  return { x: p.x + b.x, y: p.y + b.y };
}
async function anchors(page: Page) {
  const n = await node(page);
  return Promise.all(n.vertices.map((v) => position(page, [v.x, v.y])));
}
const close = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  tolerance = 0.03,
) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(tolerance);
async function prepare(page: Page, n = network()) {
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    n,
  );
  await frame(page);
  const p = pointOnVectorCubic(
    vectorSegmentCubic(n.vertices, n.segments[0])!,
    0.3,
  );
  const s = await position(page, p);
  await page.mouse.dblclick(s.x, s.y, { delay: 60 });
  await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'move'),
  );
  await frame(page);
}
async function drag(
  page: Page,
  from: [number, number],
  to: [number, number],
  release = true,
) {
  const a = await position(page, from),
    b = await position(page, to);
  await page.mouse.move(a.x, a.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await frame(page);
  if (release) {
    await page.mouse.up();
    await frame(page);
  }
  return b;
}
async function click(page: Page, point: [number, number]) {
  const p = await position(page, point);
  await page.mouse.move(p.x, p.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.up();
  await frame(page);
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
  test(`moves one shared vertex with fixed neighbors, transformed=${transformed}`, async ({
    page,
  }) => {
    const n = network();
    if (transformed)
      Object.assign(n, {
        x: 245,
        y: 40,
        rotation: 0.45,
        scaleX: -1,
        scaleY: 0.75,
      });
    await prepare(page, n);
    const before = await node(page),
      fixed = await anchors(page);
    const end = await drag(page, [80, 80], [80, 40]);
    const points = await anchors(page),
      after = await node(page);
    close(points[1], end, 2);
    close(points[0], fixed[0]);
    close(points[2], fixed[2]);
    expect(after.segments).toEqual(before.segments);
    await history(page, before, after);
  });

test('moves a whole cubic segment without accumulating origin shifts', async ({
  page,
}) => {
  const n = network();
  n.segments[0] = {
    start: 0,
    end: 1,
    tangentStart: { x: 20, y: -30 },
    tangentEnd: { x: -20, y: -30 },
  };
  await prepare(page, n);
  const before = await node(page),
    fixed = await anchors(page);
  const p = pointOnVectorCubic(
    vectorSegmentCubic(n.vertices, n.segments[0])!,
    0.25,
  );
  await drag(page, p, [p[0] + 25, p[1] - 35]);
  const points = await anchors(page),
    after = await node(page);
  for (const i of [0, 1])
    close(points[i], { x: fixed[i].x + 25, y: fixed[i].y - 35 }, 2);
  close(points[2], fixed[2]);
  expect(after.segments).toEqual(before.segments);
  await history(page, before, after);
});

test('snaps and merges at the released position, not the previous hover', async ({
  page,
}) => {
  const n = network();
  n.vertices = [
    { x: 0, y: 40 },
    { x: 70, y: 40 },
    { x: 100, y: 80 },
    { x: 180, y: 80 },
  ];
  n.segments = [
    { start: 0, end: 1 },
    { start: 2, end: 3 },
  ];
  await prepare(page, n);
  const before = await node(page);
  await drag(page, [70, 40], [98, 79]);
  const after = await node(page);
  expect(after.vertices).toHaveLength(3);
  expect(after.segments).toEqual([
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ]);
  await history(page, before, after);
});

for (const cancel of ['Escape', 'pointercancel', 'tool'])
  test(`cancels vertex movement through ${cancel}`, async ({ page }) => {
    await prepare(page);
    const before = await node(page);
    await drag(page, [80, 80], [80, 35], false);
    expect((await node(page)).vertices).not.toEqual(before.vertices);
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else if (cancel === 'tool')
      await page
        .getByRole('radio', { name: 'Bend', exact: true })
        .evaluate((el: HTMLElement) => el.click());
    else
      await page
        .locator('#left canvas')
        .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
    await frame(page);
    await page.mouse.up();
    await frame(page);
    const after = await node(page);
    for (const key of [
      'x',
      'y',
      'width',
      'height',
      'vertices',
      'segments',
      'regions',
    ] as const)
      expect(after[key]).toEqual(before[key]);
  });

for (const cancel of [false, true])
  test(`inserts a cubic midpoint atomically, cancel=${cancel}`, async ({
    page,
  }) => {
    const n = network();
    n.vertices = [
      { x: 0, y: 80 },
      { x: 180, y: 80 },
    ];
    n.segments = [
      {
        start: 0,
        end: 1,
        tangentStart: { x: 50, y: -60 },
        tangentEnd: { x: -50, y: -60 },
      },
    ];
    await prepare(page, n);
    const before = await node(page);
    const p = pointOnVectorCubic(
      vectorSegmentCubic(n.vertices, n.segments[0])!,
      0.5,
    );
    // Hover the curve first, so its midpoint affordance is visible.
    const a = await position(page, p);
    await page.mouse.move(a.x, a.y);
    await frame(page);
    await page.mouse.down();
    await frame(page);
    expect((await node(page)).vertices).toHaveLength(3);
    if (cancel) {
      await page.keyboard.press('Escape');
      await frame(page);
    }
    await page.mouse.up();
    await frame(page);
    const after = await node(page);
    if (cancel) {
      expect(after.vertices).toEqual(before.vertices);
      expect(after.segments).toEqual(before.segments);
    } else {
      expect(after.segments).toHaveLength(2);
      await history(page, before, after);
    }
  });

test('Cut stays open after release, and the separated endpoint can be moved', async ({
  page,
}) => {
  const n = network();
  n.vertices = [
    { x: 0, y: 0 },
    { x: 140, y: 0 },
    { x: 140, y: 140 },
    { x: 0, y: 140 },
  ];
  n.segments = [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
  ];
  n.regions = [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }];
  await prepare(page, n);
  const before = await node(page);
  await page.getByRole('radio', { name: 'Cut', exact: true }).click();
  await click(page, [0, 0]);
  const cut = await node(page);
  expect(cut.vertices).toHaveLength(5);
  expect(cut.regions).toEqual([]);
  const fixed = await anchors(page);
  const end = await drag(page, [0, 0], [20, 20]);
  const after = await node(page),
    points = await anchors(page);
  expect(after.vertices).toHaveLength(5);
  close(points[0], end, 2);
  points.slice(1).forEach((p, i) => close(p, fixed[i + 1]));
  await history(page, cut, after);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect((await node(page)).segments).toEqual(before.segments);
  expect((await node(page)).regions).toEqual(before.regions);
});

for (const heal of [true, false])
  test(`deletes the selected vertex after hover leaves it, heal=${heal}`, async ({
    page,
  }) => {
    await prepare(page);
    await click(page, [80, 80]);
    const before = await node(page);
    const away = await position(page, [230, 130]);
    await page.mouse.move(away.x, away.y);
    await frame(page);
    await page.keyboard.press(heal ? 'Delete' : 'Shift+Delete');
    await frame(page);
    const after = await node(page);
    expect(after.vertices).toHaveLength(2);
    expect(after.segments).toHaveLength(heal ? 1 : 0);
    await history(page, before, after);
  });

test('splits crossings after Move release as one undoable edit', async ({
  page,
}) => {
  const n = network();
  n.vertices = [
    { x: 0, y: 100 },
    { x: 140, y: 100 },
    { x: 70, y: 0 },
    { x: 70, y: 80 },
  ];
  n.segments = [
    { start: 0, end: 1 },
    { start: 2, end: 3 },
  ];
  await prepare(page, n);
  const before = await node(page),
    fixed = await anchors(page);
  const end = await drag(page, [140, 100], [140, 20], false);
  expect((await node(page)).segments).toHaveLength(2);
  await page.mouse.up();
  await frame(page);
  const after = await node(page),
    points = await anchors(page);
  expect(after.segments).toHaveLength(4);
  expect(after.vertices).toHaveLength(5);
  close(points[1], end, 2);
  for (const i of [0, 2, 3]) close(points[i], fixed[i]);
  expect(
    after.segments.filter((s) => s.start === 4 || s.end === 4),
  ).toHaveLength(4);
  await history(page, before, after);
});
