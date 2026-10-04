import { expect, test, type Page } from '@playwright/test';
import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});
test.setTimeout(60000);

const rect = (id = 'shape', x = 40, y = 40): RectSerializedNode => ({
  id,
  type: 'rect',
  x,
  y,
  width: 120,
  height: 100,
  zIndex: 0,
  fills: [{ type: 'solid', value: '#ff8400' }],
});
const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const node = (page: Page) =>
  page.evaluate(
    () => window.canvasRegression.state('left')!.nodes[0] as RectSerializedNode,
  );
async function position(page: Page, point: [number, number], id = 'shape') {
  const p = await page.evaluate(
    ({ id, point }) => window.canvasRegression.viewportPoint('left', id, point),
    { id, point },
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  return { x: box.x + p.x, y: box.y + p.y };
}

// Trusted touch events exercise pointerdown without a preceding mouse hover.
async function touchDrag(
  page: Page,
  start: { x: number; y: number },
  delta: [number, number],
) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1, radiusX: 10, radiusY: 10, force: 1 }],
    });
    await frame(page);
    for (let step = 1; step <= 5; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: start.x + (delta[0] * step) / 5,
            y: start.y + (delta[1] * step) / 5,
            id: 1,
            radiusX: 10,
            radiusY: 10,
            force: 1,
          },
        ],
      });
      await frame(page);
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await frame(page);
  } finally {
    await session.detach();
  }
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
  // The bare renderer fixture needs the same touch-action as the production
  // web component. Stack the canvases so all targets fit the phone viewport.
  await page.addStyleTag({
    content: 'body{margin:8px}main{display:block}canvas{touch-action:none}',
  });
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    rect(),
  );
  await frame(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

for (const zoom of [1, 1.5]) {
  test(`resizes a padded corner by finger displacement at zoom ${zoom}, with one undo step`, async ({
    page,
  }) => {
    await page.evaluate(
      (zoom) => window.canvasRegression.setZoom('left', zoom),
      zoom,
    );
    await frame(page);
    const corner = await position(page, [120, 100]);
    await touchDrag(page, { x: corner.x + 12, y: corner.y + 8 }, [30, 20]);
    const after = await node(page);
    // Input stores viewport positions as integer pixels; allow rounding at
    // both ends of the gesture without accepting a jump to the padded target.
    expect(Math.abs(after.width! - (120 + 30 / zoom))).toBeLessThan(1.5);
    expect(Math.abs(after.height! - (100 + 20 / zoom))).toBeLessThan(1.5);
    expect(after.rotation ?? 0).toBe(0);
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await frame(page);
    expect(await node(page)).toMatchObject({ width: 120, height: 100 });
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await frame(page);
    expect((await node(page)).width).toBeCloseTo(after.width!, 3);
  });
}

test('resolves each press after a resize: shape body moves instead of reusing the corner', async ({
  page,
}) => {
  const corner = await position(page, [120, 100]);
  await touchDrag(page, { x: corner.x + 12, y: corner.y + 8 }, [30, 20]);
  const resized = await node(page);
  await page.waitForTimeout(310); // Separate gestures from double-tap editing.
  const body = await position(page, [resized.width! / 2, resized.height! / 2]);
  await touchDrag(page, body, [20, 20]);
  const moved = await node(page);
  expect(moved.width).toBeCloseTo(resized.width!, 3);
  expect(moved.height).toBeCloseTo(resized.height!, 3);
  expect(Math.abs(moved.x! - 60)).toBeLessThan(1.5);
  expect(Math.abs(moved.y! - 60)).toBeLessThan(1.5);
  expect(moved.rotation ?? 0).toBe(0);
});

test('taps another shape after resizing without a hover event', async ({
  page,
}) => {
  await page.evaluate(
    (nodes) => window.canvasRegression.setScene('left', nodes, 'shape'),
    [rect(), rect('other', 190, 80)],
  );
  await frame(page);
  const corner = await position(page, [120, 100]);
  await touchDrag(page, { x: corner.x + 10, y: corner.y + 8 }, [10, 10]);
  await page.waitForTimeout(310);
  const other = await position(page, [40, 40], 'other');
  await page.touchscreen.tap(other.x, other.y);
  await frame(page);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('left')!.state.layersSelected,
    ),
  ).toEqual(['other']);
  expect((await node(page)).rotation ?? 0).toBe(0);
});

test('edge resizing wins over a nearby rotation ring for a finger', async ({
  page,
}) => {
  const edge = await position(page, [30, 0]);
  await touchDrag(page, { x: edge.x, y: edge.y - 16 }, [0, -20]);
  const resized = await node(page);
  expect(resized.width).toBeCloseTo(120, 0);
  expect(resized.height).toBeCloseTo(120, 0);
  expect(resized.y).toBeCloseTo(20, 0);
  expect(resized.rotation ?? 0).toBe(0);
});

test('rotation remains available outside the enlarged finger resize target', async ({
  page,
}) => {
  const corner = await position(page, [120, 100]);
  await touchDrag(page, { x: corner.x + 25, y: corner.y + 25 }, [-20, 20]);
  const rotated = await node(page);
  expect(Math.abs(rotated.rotation ?? 0)).toBeGreaterThan(0.1);
  expect(rotated.width).toBeCloseTo(120, 0);
  expect(rotated.height).toBeCloseTo(100, 0);
});

test('mouse retains its precise rotation ring at the same padded corner', async ({
  page,
}) => {
  const corner = await position(page, [120, 100]);
  // No settled hover frame: the press must resolve its own target.
  await page.mouse.move(corner.x + 12, corner.y + 8);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(corner.x - 8, corner.y + 28, { steps: 5 });
  await frame(page);
  await page.mouse.up();
  await frame(page);
  const rotated = await node(page);
  expect(Math.abs(rotated.rotation ?? 0)).toBeGreaterThan(0.1);
  expect(rotated.width).toBeCloseTo(120, 0);
  expect(rotated.height).toBeCloseTo(100, 0);
});

test('a mouse can still drag the rotation pivot after hovering its handle', async ({
  page,
}) => {
  const center = await position(page, [60, 50]);
  await page.mouse.move(center.x, center.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(center.x + 20, center.y + 10, { steps: 5 });
  await frame(page);
  await page.mouse.up();
  await frame(page);
  expect(await node(page)).toMatchObject({
    x: 40,
    y: 40,
    width: 120,
    height: 100,
  });
  const pivot = await page.evaluate(() =>
    window.canvasRegression.rotationPivot('left'),
  );
  expect(pivot.pinned).toBe(true);
  expect(Math.abs(pivot.x - 80)).toBeLessThan(1.5);
  expect(Math.abs(pivot.y - 60)).toBeLessThan(1.5);
});
