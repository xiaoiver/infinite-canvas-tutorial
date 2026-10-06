import { expect, test, type Page } from '@playwright/test';
import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

const rect = (
  id: string,
  x: number,
  y: number,
  width = 40,
  height = 40,
): RectSerializedNode => ({
  id,
  type: 'rect',
  x,
  y,
  width,
  height,
  zIndex: 0,
  fills: [{ type: 'solid', value: '#ff8400' }],
});
const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const node = (page: Page, id = 'shape') =>
  page.evaluate(
    (id) =>
      window.canvasRegression
        .state('left')!
        .nodes.find((node) => node.id === id) as RectSerializedNode,
    id,
  );
async function position(page: Page, point: [number, number], id = 'shape') {
  const p = await page.evaluate(
    ({ id, point }) => window.canvasRegression.viewportPoint('left', id, point),
    { id, point },
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  return { x: box.x + p.x, y: box.y + p.y };
}
async function scene(
  page: Page,
  nodes = [rect('shape', 40, 100), rect('reference', 100, 20)],
) {
  await page.evaluate(
    (nodes) => window.canvasRegression.setScene('left', nodes, 'shape'),
    nodes,
  );
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', {
      snapToObjectsEnabled: true,
      snapToObjectsDistance: 8,
      snapToPixelGridEnabled: false,
    }),
  );
  await frame(page);
}
async function press(page: Page, point: [number, number], id = 'shape') {
  const start = await position(page, point, id);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await frame(page);
  return start;
}
async function move(
  page: Page,
  start: { x: number; y: number },
  dx: number,
  dy = 0,
) {
  await page.mouse.move(start.x + dx, start.y + dy);
  await frame(page);
}
async function release(page: Page) {
  await page.mouse.up();
  await frame(page);
  expect(await page.locator('#left svg line').count()).toBe(0);
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
  await scene(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('object snapping works without pixel-grid snapping and releases from the raw pointer', async ({
  page,
}) => {
  const start = await press(page, [12, 18]);
  await move(page, start, 15);
  expect((await node(page)).x).toBeCloseTo(60, 3);
  expect(await page.locator('#left svg line').count()).toBeGreaterThan(0);
  // Many small moves past the same target must escape, without an accumulated jump.
  for (let dx = 16; dx <= 31; dx++) await move(page, start, dx);
  expect((await node(page)).x).toBeCloseTo(71, 3);
  await move(page, start, 0);
  expect((await node(page)).x).toBeCloseTo(40, 3);
  await release(page);
});

test('slow dragging with both snapping modes never feeds the snapped position back into the next sample', async ({
  page,
}) => {
  // A reference off the grid exposes the old alternating object/grid correction.
  await scene(page, [rect('shape', 40, 100), rect('reference', 103, 20)]);
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', {
      snapToPixelGridEnabled: true,
      snapToPixelGridSize: 10,
    }),
  );
  const start = await press(page, [12, 18]);
  for (let dx = 1; dx <= 24; dx++) {
    await move(page, start, dx);
    if (dx >= 15) expect((await node(page)).x).toBeCloseTo(63, 3);
  }
  await move(page, start, 120);
  expect((await node(page)).x).toBeCloseTo(160, 3);
  await release(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect((await node(page)).x).toBeCloseTo(40, 3);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await frame(page);
  expect((await node(page)).x).toBeCloseTo(160, 3);
});

for (const zoom of [0.5, 2]) {
  test(`uses an 8 CSS-pixel attraction radius at zoom ${zoom}`, async ({
    page,
  }) => {
    await scene(page, [
      rect('shape', 20, 40, 80, 80),
      rect('reference', 140, 0),
    ]);
    await page.evaluate(
      (zoom) => window.canvasRegression.setZoom('left', zoom),
      zoom,
    );
    await frame(page);
    const start = await press(page, [25, 40]);
    await move(page, start, 40 * zoom - 6);
    expect((await node(page)).x).toBeCloseTo(60, 2);
    await move(page, start, 40 * zoom + 10);
    expect((await node(page)).x).toBeCloseTo(60 + 10 / zoom, 2);
    await release(page);
  });
}

test('resizing the right edge snaps that edge, preserves the opposite edge, and releases', async ({
  page,
}) => {
  const start = await press(page, [40, 20]);
  await move(page, start, 15);
  expect(await node(page)).toMatchObject({
    x: 40,
    y: 100,
    width: 60,
    height: 40,
  });
  expect(await page.locator('#left svg line').count()).toBeGreaterThan(0);
  await move(page, start, 31);
  expect((await node(page)).width).toBeCloseTo(71, 2);
  await move(page, start, 15);
  await release(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect((await node(page)).width).toBeCloseTo(40, 2);
});

test('leaves an initially aligned object through one-pixel moves', async ({
  page,
}) => {
  await scene(page, [rect('shape', 60, 100), rect('reference', 100, 20)]);
  const start = await press(page, [12, 18]);
  for (let dx = 1; dx <= 11; dx++) await move(page, start, dx);
  expect((await node(page)).x).toBeCloseTo(71, 2);
  await release(page);
});

test('dragging still matches equal spacing between other objects', async ({
  page,
}) => {
  await scene(page, [
    rect('shape', 220, 100),
    rect('a', 20, 100),
    rect('b', 100, 100),
  ]);
  const start = await press(page, [12, 18]);
  await move(page, start, -35);
  expect((await node(page)).x).toBeCloseTo(180, 2);
  expect(await page.locator('#left svg text').allTextContents()).toContain(
    '40',
  );
  await release(page);
});

test('hidden shapes and the other canvas do not supply snap targets', async ({
  page,
}) => {
  await scene(page, [
    rect('shape', 40, 100),
    { ...rect('reference', 100, 20), visibility: 'hidden' },
  ]);
  const start = await press(page, [12, 18]);
  await move(page, start, 15);
  expect((await node(page)).x).toBeCloseTo(55, 2);
  expect(await page.locator('#left svg line').count()).toBe(0);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('right')!.nodes[0].x,
    ),
  ).toBe(40);
  await release(page);
});

test('object snapping can be turned off during a drag without retaining its correction', async ({
  page,
}) => {
  const start = await press(page, [12, 18]);
  await move(page, start, 15);
  expect((await node(page)).x).toBeCloseTo(60, 2);
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', {
      snapToObjectsEnabled: false,
    }),
  );
  await move(page, start, 16);
  expect((await node(page)).x).toBeCloseTo(56, 2);
  expect(await page.locator('#left svg line').count()).toBe(0);
  await release(page);
});

test('resizes both axes at a corner and restores the original geometry with one undo', async ({
  page,
}) => {
  await scene(page, [rect('shape', 40, 100), rect('reference', 100, 160)]);
  const start = await press(page, [40, 40]);
  await move(page, start, 15, 15);
  expect((await node(page)).width).toBeCloseTo(60, 2);
  expect((await node(page)).height).toBeCloseTo(60, 2);
  expect((await node(page)).x).toBe(40);
  expect((await node(page)).y).toBe(100);
  await release(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect(await node(page)).toMatchObject({
    x: 40,
    y: 100,
    width: 40,
    height: 40,
  });
});

test('left and top edge resizing only snaps the moving axis', async ({
  page,
}) => {
  await scene(page, [
    rect('shape', 100, 100, 80, 80),
    rect('reference', 40, 20),
  ]);
  const start = await press(page, [0, 40]);
  await move(page, start, -15, -3);
  const resized = await node(page);
  expect(resized.x).toBeCloseTo(80, 2);
  expect(resized.width).toBeCloseTo(100, 2);
  expect(resized.y).toBe(100);
  expect(resized.height).toBe(80);
  await release(page);
});

test('aspect-ratio resize snaps along the constrained ray', async ({
  page,
}) => {
  await scene(page, [
    { ...rect('shape', 40, 100), lockAspectRatio: true },
    rect('reference', 100, 20),
  ]);
  const start = await press(page, [40, 40]);
  await move(page, start, 15, 15);
  const resized = await node(page);
  expect(resized.width).toBeCloseTo(60, 2);
  expect(resized.height).toBeCloseTo(60, 2);
  expect(resized.x).toBeCloseTo(40, 2);
  expect(resized.y).toBeCloseTo(100, 2);
  await release(page);
});

test('Alt edge resizing preserves the original center while snapping', async ({
  page,
}) => {
  await page.keyboard.down('Alt');
  const start = await press(page, [40, 20]);
  await move(page, start, 15);
  let resized = await node(page);
  expect(resized.x! + resized.width! / 2).toBeCloseTo(60, 2);
  expect(resized.x! + resized.width!).toBeCloseTo(100, 2);
  await move(page, start, 31);
  resized = await node(page);
  expect(resized.x! + resized.width! / 2).toBeCloseTo(60, 2);
  expect(resized.x! + resized.width!).toBeCloseTo(111, 2);
  await release(page);
  await page.keyboard.up('Alt');
});

test('Alt aspect-ratio corner resizing keeps its center through repeated snapped samples', async ({
  page,
}) => {
  await scene(page, [
    { ...rect('shape', 40, 100), lockAspectRatio: true },
    rect('reference', 100, 20),
  ]);
  await page.keyboard.down('Alt');
  const start = await press(page, [40, 40]);
  for (let d = 5; d <= 15; d += 5) await move(page, start, d, d);
  const resized = await node(page);
  expect(resized.x! + resized.width! / 2).toBeCloseTo(60, 2);
  expect(resized.y! + resized.height! / 2).toBeCloseTo(120, 2);
  expect(resized.width).toBeCloseTo(resized.height!, 2);
  expect(resized.x! + resized.width!).toBeCloseTo(100, 2);
  await release(page);
  await page.keyboard.up('Alt');
});

test('multi-selection resize snaps its outer edge and commits both nodes together', async ({
  page,
}) => {
  await scene(page, [
    rect('shape', 40, 100),
    rect('second', 90, 100),
    rect('reference', 150, 20),
  ]);
  await page.evaluate(() =>
    window.canvasRegression.selectNodes('left', ['shape', 'second']),
  );
  await frame(page);
  const start = await press(page, [40, 40], 'second');
  await move(page, start, 15);
  const second = await node(page, 'second');
  expect(second.x! + second.width!).toBeCloseTo(150, 2);
  expect((await node(page)).x).toBeCloseTo(40, 2);
  await release(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  expect((await node(page)).width).toBeCloseTo(40, 2);
  expect((await node(page, 'second')).x).toBeCloseTo(90, 2);
});

test('rotated edge resizing snaps the handle without changing the rotation or opposite edge', async ({
  page,
}) => {
  await scene(page, [
    { ...rect('shape', 60, 80, 60, 80), rotation: Math.PI / 6 },
    rect('reference', 100, 0),
  ]);
  const start = await press(page, [60, 40]);
  const opposite = await position(page, [0, 40]);
  // Its right-edge midpoint starts at x≈92; moving outward gets within 8px of x=100.
  await move(page, start, 4, 2);
  const edge = await position(page, [(await node(page)).width!, 40]);
  const box = (await page.locator('#left canvas').boundingBox())!;
  expect(edge.x - box.x).toBeCloseTo(100, 1);
  expect((await node(page)).rotation).toBeCloseTo(Math.PI / 6, 4);
  const afterOpposite = await position(page, [0, 40]);
  expect(afterOpposite.x).toBeCloseTo(opposite.x, 2);
  expect(afterOpposite.y).toBeCloseTo(opposite.y, 2);
  await release(page);
});

test('resizing a group excludes its own descendants from snap references', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'group',
          type: 'g',
          x: 40,
          y: 100,
          width: 80,
          height: 80,
          zIndex: 0,
        },
        {
          id: 'child',
          type: 'rect',
          parentId: 'group',
          x: 0,
          y: 0,
          width: 80,
          height: 80,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#ff8400' }],
        },
      ],
      'group',
    ),
  );
  await frame(page);
  const start = await press(page, [80, 80], 'child');
  await move(page, start, 5, 5);
  const child = await node(page, 'child');
  expect(child.width).toBeCloseTo(85, 2);
  expect(child.height).toBeCloseTo(85, 2);
  expect(await page.locator('#left svg line').count()).toBe(0);
  await release(page);
});

test('line endpoint resize uses object guides and leaves the other endpoint fixed', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'shape',
          type: 'line',
          x: 40,
          y: 100,
          width: 40,
          height: 40,
          x1: 0,
          y1: 0,
          x2: 40,
          y2: 40,
          stroke: '#ff8400',
          strokeWidth: 2,
          zIndex: 0,
        },
        {
          id: 'reference',
          type: 'rect',
          x: 100,
          y: 160,
          width: 40,
          height: 40,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#147af3' }],
        },
      ],
      'shape',
    ),
  );
  await frame(page);
  const start = await press(page, [40, 40]);
  await move(page, start, 15, 15);
  const endpoint = await position(page, [60, 60]);
  const box = (await page.locator('#left canvas').boundingBox())!;
  expect(endpoint.x - box.x).toBeCloseTo(100, 1);
  expect(endpoint.y - box.y).toBeCloseTo(160, 1);
  const result = await page.evaluate(() =>
    window.canvasRegression
      .state('left')!
      .nodes.find((node) => node.id === 'shape'),
  );
  expect(result).toMatchObject({ x: 40, y: 100, x1: 0, y1: 0, x2: 60, y2: 60 });
  await release(page);
});

test('Escape removes active guides before a subsequent gesture', async ({
  page,
}) => {
  const start = await press(page, [12, 18]);
  await move(page, start, 15);
  expect(await page.locator('#left svg line').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await frame(page);
  expect(await page.locator('#left svg line').count()).toBe(0);
  await release(page);
});

test('moving a child of a rotated parent applies the snapped displacement in world space', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'group',
          type: 'g',
          x: 160,
          y: 40,
          rotation: Math.PI / 2,
          zIndex: 0,
        },
        {
          id: 'shape',
          type: 'rect',
          parentId: 'group',
          x: 40,
          y: 20,
          width: 80,
          height: 80,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#ff8400' }],
        },
        {
          id: 'reference',
          type: 'rect',
          x: 160,
          y: 0,
          width: 40,
          height: 40,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#147af3' }],
        },
      ],
      'shape',
    ),
  );
  await frame(page);
  const start = await press(page, [30, 35]);
  await move(page, start, 15);
  const result = await node(page);
  expect(result.x).toBeCloseTo(40, 2);
  expect(result.y).toBeCloseTo(0, 2);
  const corner = await position(page, [0, 0]);
  const box = (await page.locator('#left canvas').boundingBox())!;
  expect(corner.x - box.x).toBeCloseTo(160, 1);
  expect(corner.y - box.y).toBeCloseTo(80, 1);
  await release(page);
});
