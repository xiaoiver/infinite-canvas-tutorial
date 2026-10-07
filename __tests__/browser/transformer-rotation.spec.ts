import { expect, test, type Page } from '@playwright/test';
import type { RectSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

type Point = { x: number; y: number };
const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const transformer = (page: Page) =>
  page.evaluate(() => window.canvasRegression.transformer('left'));
const nodes = (page: Page) =>
  page.evaluate(
    () => window.canvasRegression.state('left')!.nodes as RectSerializedNode[],
  );
const rotated = (point: Point, pivot: Point, angle: number): Point => ({
  x:
    pivot.x +
    (point.x - pivot.x) * Math.cos(angle) -
    (point.y - pivot.y) * Math.sin(angle),
  y:
    pivot.y +
    (point.x - pivot.x) * Math.sin(angle) +
    (point.y - pivot.y) * Math.cos(angle),
});
function expectPoint(actual: Point, expected: Point) {
  expect(actual.x).toBeCloseTo(expected.x, 1);
  expect(actual.y).toBeCloseTo(expected.y, 1);
}
async function pointer(page: Page, point: Point) {
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await frame(page);
}
async function beginRotation(page: Page) {
  const before = await transformer(page);
  const corner = before.anchors[2];
  const start = { x: corner.x + 12, y: corner.y + 8 };
  await pointer(page, start);
  await page.mouse.down();
  await frame(page);
  return { before, start, pivot: before.anchors[4] };
}
async function release(page: Page) {
  await page.mouse.up();
  await frame(page);
}
async function expectFollows(
  page: Page,
  gesture: Awaited<ReturnType<typeof beginRotation>>,
  angle: number,
) {
  await pointer(page, rotated(gesture.start, gesture.pivot, angle));
  const currentNodes = await nodes(page);
  // Browser coordinates are rounded; use the actual node angle to compare the
  // rendered transformer against the same rigid rotation of its original frame.
  const applied = currentNodes[0].rotation ?? 0;
  expect(applied).toBeCloseTo(angle, 1);
  const current = await transformer(page);
  expect(current.rotation).toBeCloseTo(applied, 4);
  expect(current.width).toBeCloseTo(gesture.before.width, 3);
  expect(current.height).toBeCloseTo(gesture.before.height, 3);
  current.anchors.forEach((anchor, i) =>
    expectPoint(
      anchor,
      rotated(gesture.before.anchors[i], gesture.pivot, applied),
    ),
  );
  currentNodes.forEach((node, i) => {
    expect(node.rotation).toBeCloseTo(applied, 4);
    expect(node.width).toBeCloseTo(40, 3);
    expect(node.height).toBeCloseTo(40, 3);
    expectPoint(
      { x: node.x!, y: node.y! },
      rotated(
        i === 0 ? { x: 70, y: 60 } : { x: 170, y: 100 },
        gesture.pivot,
        applied,
      ),
    );
  });
}
async function expectEnclosesSelection(page: Page) {
  const corners = await page.evaluate(() =>
    window.canvasRegression.state('left')!.nodes.flatMap((node) =>
      [
        [0, 0],
        [node.width, 0],
        [node.width, node.height],
        [0, node.height],
      ].map((point) =>
        window.canvasRegression.viewportPoint(
          'left',
          node.id,
          point as [number, number],
        ),
      ),
    ),
  );
  const current = await transformer(page);
  expect(current.status).not.toBe('rotating');
  expect(current.rotation).toBe(0);
  expectPoint(current.anchors[0], {
    x: Math.min(...corners.map((p) => p.x)),
    y: Math.min(...corners.map((p) => p.y)),
  });
  expectPoint(current.anchors[2], {
    x: Math.max(...corners.map((p) => p.x)),
    y: Math.max(...corners.map((p) => p.y)),
  });
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
  await page.evaluate(async () => {
    const nodes: RectSerializedNode[] = [
      { id: 'a', type: 'rect', x: 70, y: 60, width: 40, height: 40 },
      { id: 'b', type: 'rect', x: 170, y: 100, width: 40, height: 40 },
    ].map((node) => ({
      ...node,
      type: 'rect',
      zIndex: 0,
      fills: [{ type: 'solid', value: '#ff8400' }],
    }));
    await window.canvasRegression.setScene('left', nodes, ['a', 'b']);
    await window.canvasRegression.setPreferences('left', {
      snapToObjectsEnabled: false,
      snapToPixelGridEnabled: false,
    });
  });
  await frame(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('multi-selection frame and all anchors follow rotation through reversal and an angle wrap', async ({
  page,
}) => {
  const gesture = await beginRotation(page);
  for (const angle of [0.3, 0.8, 1.6, 2.8, 1.2, 0]) {
    await expectFollows(page, gesture, angle);
  }
  await release(page);
  await expectEnclosesSelection(page);
});

test('multi-selection follows a pinned pivot and retains it after release', async ({
  page,
}) => {
  const before = await transformer(page);
  await pointer(page, before.anchors[4]);
  await page.mouse.down();
  await frame(page);
  const pivot = { x: before.anchors[4].x + 20, y: before.anchors[4].y - 15 };
  await pointer(page, pivot);
  await release(page);
  expectPoint((await transformer(page)).anchors[4], pivot);
  const gesture = await beginRotation(page);
  await expectFollows(page, gesture, 0.7);
  await release(page);
  await expectEnclosesSelection(page);
  expectPoint((await transformer(page)).anchors[4], pivot);
  const second = await beginRotation(page);
  await pointer(page, rotated(second.start, pivot, 0.4));
  expect((await transformer(page)).rotation).toBeCloseTo(0.4, 1);
  expectPoint((await transformer(page)).anchors[4], pivot);
  expect((await nodes(page))[0].rotation).toBeCloseTo(1.1, 1);
  await release(page);
  await expectEnclosesSelection(page);
  expectPoint((await transformer(page)).anchors[4], pivot);
});

test('release refreshes the selection bounds and consecutive rotation gestures undo separately', async ({
  page,
}) => {
  const initial = await nodes(page);
  const first = await beginRotation(page);
  await pointer(page, rotated(first.start, first.pivot, 0.4));
  await release(page);
  const once = await nodes(page);
  await expectEnclosesSelection(page);
  const second = await beginRotation(page);
  await pointer(page, rotated(second.start, second.pivot, 0.5));
  await release(page);
  const twice = await nodes(page);
  expect(twice[0].rotation).toBeCloseTo(0.9, 1);
  await expectEnclosesSelection(page);
  for (const expected of [once, initial]) {
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await frame(page);
    (await nodes(page)).forEach((node, i) => {
      expectPoint(
        { x: node.x!, y: node.y! },
        { x: expected[i].x!, y: expected[i].y! },
      );
      expect(node.rotation ?? 0).toBeCloseTo(expected[i].rotation ?? 0, 4);
    });
    await expectEnclosesSelection(page);
  }
  for (const expected of [once, twice]) {
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await frame(page);
    (await nodes(page)).forEach((node, i) => {
      expectPoint(
        { x: node.x!, y: node.y! },
        { x: expected[i].x!, y: expected[i].y! },
      );
      expect(node.rotation ?? 0).toBeCloseTo(expected[i].rotation ?? 0, 4);
    });
    await expectEnclosesSelection(page);
  }
});

test('Escape clears the rotating frame before reselecting and rotating again', async ({
  page,
}) => {
  const gesture = await beginRotation(page);
  await pointer(page, rotated(gesture.start, gesture.pivot, 0.5));
  await page.keyboard.press('Escape');
  await release(page);
  expect((await transformer(page)).visible).toBe(false);
  await page.evaluate(() =>
    window.canvasRegression.selectNodes('left', ['a', 'b']),
  );
  await frame(page);
  await expectEnclosesSelection(page);
  const next = await beginRotation(page);
  await pointer(page, rotated(next.start, next.pivot, -0.3));
  const current = await transformer(page);
  expect(current.rotation).toBeCloseTo(-0.3, 1);
  await release(page);
  await expectEnclosesSelection(page);
});

test('release over the pivot finishes rotation before the hover target changes', async ({
  page,
}) => {
  const initial = await nodes(page);
  const gesture = await beginRotation(page);
  await pointer(page, rotated(gesture.start, gesture.pivot, 0.5));
  // The final pointer position hits the center handle, not the rotation ring.
  await pointer(page, { x: gesture.pivot.x + 2, y: gesture.pivot.y + 1 });
  await release(page);
  await expectEnclosesSelection(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  (await nodes(page)).forEach((node, i) => {
    expectPoint(
      { x: node.x!, y: node.y! },
      { x: initial[i].x!, y: initial[i].y! },
    );
    expect(node.rotation ?? 0).toBe(0);
  });
  await expectEnclosesSelection(page);
});
