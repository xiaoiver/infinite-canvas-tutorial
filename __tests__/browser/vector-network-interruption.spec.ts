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
type Gesture = 'move' | 'curve' | 'handle' | 'midpoint';
const seed = (): VectorNetworkSerializedNode => ({
  id: 'interruption',
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
    { start: 0, end: 1, tangentEnd: { x: -30, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 40, y: 0 } },
  ],
  regions: [],
  fills: [],
  strokes: [{ type: 'solid', value: '#000' }],
  strokeWidth: 2,
});
const nodes = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes as VectorNetworkSerializedNode[],
  );
const node = async (page: Page) => (await nodes(page))[0];
const geometry = (n: VectorNetworkSerializedNode) => ({
  x: n.x,
  y: n.y,
  width: n.width,
  height: n.height,
  rotation: n.rotation,
  scaleX: n.scaleX,
  scaleY: n.scaleY,
  vertices: n.vertices,
  segments: n.segments,
  regions: n.regions,
});
async function frame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}
async function point(page: Page, p: [number, number]) {
  const q = await page.evaluate(
    (p) => window.canvasRegression.viewportPoint('left', 'interruption', p),
    p,
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  return { x: box.x + q.x, y: box.y + q.y };
}
async function prepare(page: Page) {
  const n = seed();
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    n,
  );
  await frame(page);
  const p = await point(
    page,
    pointOnVectorCubic(vectorSegmentCubic(n.vertices, n.segments[0])!, 0.3),
  );
  await page.mouse.dblclick(p.x, p.y, { delay: 60 });
  await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.update('left', 'interruption', { isEditing: true }),
  );
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'interruption'),
  );
  await frame(page);
}
async function start(page: Page, kind: Gesture) {
  if (kind === 'curve' || kind === 'handle')
    await page.getByRole('radio', { name: 'Bend', exact: true }).click();
  const n = await node(page);
  let p: { x: number; y: number };
  if (kind === 'handle') {
    p = await point(page, [n.vertices[1].x, n.vertices[1].y]);
    await page.mouse.move(p.x, p.y);
    await frame(page);
    await page.mouse.click(p.x, p.y, { delay: 50 });
    await frame(page);
    p = await point(page, [n.vertices[1].x + 40, n.vertices[1].y]);
  } else if (kind === 'move')
    p = await point(page, [n.vertices[1].x, n.vertices[1].y]);
  else
    p = await point(
      page,
      pointOnVectorCubic(
        vectorSegmentCubic(n.vertices, n.segments[0])!,
        kind === 'curve' ? 0.25 : 0.5,
      ),
    );
  await page.mouse.move(p.x, p.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(p.x + 5, p.y - 35, { steps: 5 });
  await frame(page);
  expect(geometry(await node(page))).not.toEqual(geometry(n));
  return p;
}
async function releaseAfterMoreMovement(
  page: Page,
  p: { x: number; y: number },
) {
  await page.mouse.move(p.x + 15, p.y - 45, { steps: 3 });
  await frame(page);
  await page.mouse.up();
  await frame(page);
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
  await prepare(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

for (const kind of ['move', 'curve', 'handle', 'midpoint'] as const) {
  for (const direction of ['undo', 'redo'] as const)
    test(`${direction} during ${kind} restores complete committed geometry`, async ({
      page,
    }) => {
      const original = await node(page);
      await page.evaluate(
        (vertices) =>
          window.canvasRegression.update('left', 'interruption', { vertices }),
        original.vertices.map((v, i) => (i === 1 ? { ...v, y: 60 } : v)),
      );
      const committed = await node(page);
      if (direction === 'redo') {
        await page.evaluate(() => window.canvasRegression.undo('left'));
        await frame(page);
      }
      const p = await start(page, kind);
      await page.evaluate(
        (direction) => window.canvasRegression[direction]('left'),
        direction,
      );
      await frame(page);
      const expected = geometry(direction === 'undo' ? original : committed);
      expect(geometry(await node(page))).toEqual(expected);
      await releaseAfterMoreMovement(page, p);
      expect(geometry(await node(page))).toEqual(expected);
      // A trailing release must not clear redo or insert another edit.
      await page.evaluate(
        (direction) =>
          window.canvasRegression[direction === 'undo' ? 'redo' : 'undo'](
            'left',
          ),
        direction,
      );
      await frame(page);
      expect(geometry(await node(page))).toEqual(
        geometry(direction === 'undo' ? committed : original),
      );
    });
  test(`external geometry replaces an active ${kind} without being overwritten`, async ({
    page,
  }) => {
    const p = await start(page, kind),
      current = await node(page);
    await page.evaluate(
      (vertices) =>
        window.canvasRegression.update('left', 'interruption', { vertices }),
      current.vertices.map((v, i) =>
        i === 0 ? { ...v, x: v.x + 12, y: v.y + 6 } : v,
      ),
    );
    const remote = geometry(await node(page));
    await releaseAfterMoreMovement(page, p);
    await page.keyboard.press('Escape');
    await frame(page);
    expect(geometry(await node(page))).toEqual(remote);
  });
}

test('style changes survive cancelling geometry, and a fresh drag still works', async ({
  page,
}) => {
  const original = await node(page),
    p = await start(page, 'move');
  await page.evaluate(() =>
    window.canvasRegression.update('left', 'interruption', {
      strokes: [{ type: 'solid', value: '#147af3' }],
    }),
  );
  await page
    .locator('#left canvas')
    .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await frame(page);
  await releaseAfterMoreMovement(page, p);
  expect(geometry(await node(page))).toEqual(geometry(original));
  expect((await node(page)).strokes).toEqual([
    { type: 'solid', value: '#147af3' },
  ]);
  const next = await start(page, 'move');
  await releaseAfterMoreMovement(page, next);
  expect(geometry(await node(page))).not.toEqual(geometry(original));
});

test('external rotation survives both Escape and the trailing release', async ({
  page,
}) => {
  const p = await start(page, 'move');
  await page.evaluate(() =>
    window.canvasRegression.update('left', 'interruption', { rotation: 0.3 }),
  );
  const remote = geometry(await node(page));
  await page.keyboard.press('Escape');
  await frame(page);
  await releaseAfterMoreMovement(page, p);
  expect(geometry(await node(page))).toEqual(remote);
});

test('deleting the document node during a drag never recreates it', async ({
  page,
}) => {
  const p = await start(page, 'move');
  await page.evaluate(() =>
    window.canvasRegression.remove('left', 'interruption'),
  );
  await frame(page);
  await releaseAfterMoreMovement(page, p);
  await page.keyboard.press('Escape');
  await frame(page);
  expect(await nodes(page)).toEqual([]);
});

for (const kind of ['move', 'midpoint'] as const)
  test(`Delete during ${kind} rolls back the unfinished gesture first`, async ({
    page,
  }) => {
    const original = await node(page),
      p = await start(page, kind);
    await page.keyboard.press('Shift+Delete');
    await frame(page);
    const deleted = geometry(await node(page));
    expect(deleted.vertices).toHaveLength(kind === 'midpoint' ? 3 : 2);
    expect(deleted.segments).toHaveLength(kind === 'midpoint' ? 2 : 0);
    if (kind === 'midpoint') expect(deleted).toEqual(geometry(original));
    await releaseAfterMoreMovement(page, p);
    expect(geometry(await node(page))).toEqual(deleted);
    if (kind === 'move') {
      await page.evaluate(() => window.canvasRegression.undo('left'));
      await frame(page);
      expect(geometry(await node(page))).toEqual(geometry(original));
    }
  });

test('destroying a canvas during a drag releases its history callback', async ({
  page,
}) => {
  await start(page, 'move');
  await page.evaluate(() => window.canvasRegression.recreate('left'));
  await page.mouse.up();
  await frame(page);
  await page.evaluate(() => window.canvasRegression.edit('left'));
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect((await nodes(page))[0].width).toBe(120);
});

test('cancelling a curve returned to its starting point also restores rebased bounds', async ({
  page,
}) => {
  const original = geometry(await node(page));
  const p = await start(page, 'curve');
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await frame(page);
  await page
    .locator('#left canvas')
    .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await frame(page);
  await releaseAfterMoreMovement(page, p);
  expect(geometry(await node(page))).toEqual(original);
});
