import { expect, test, type Page } from '@playwright/test';
import {
  pointOnVectorCubic,
  vectorSegmentCubic,
} from '../../packages/ecs/src/utils/vector-network-curve';
import type { Pen } from '../../packages/ecs/src/components/Canvas';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';
declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const couplingPicker = (page: Page) =>
  page.locator('sp-picker[label="Handle coupling"]');
async function selectCoupling(page: Page, mode: string) {
  const labels: Record<string, string> = {
    NONE: 'Independent',
    ANGLE: 'Align angles',
    ANGLE_AND_LENGTH: 'Mirror angle and length',
  };
  await couplingPicker(page).locator('button').click();
  await page.getByRole('option', { name: labels[mode], exact: true }).click();
  await expect(couplingPicker(page)).toHaveJSProperty('value', mode);
}
const network = (): VectorNetworkSerializedNode => ({
  id: 'bend',
  type: 'vector-network',
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
  strokes: [{ type: 'solid', value: '#000000' }],
  strokeWidth: 2,
});
const node = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes[0] as VectorNetworkSerializedNode,
  );
async function frame(page: Page) {
  await page.evaluate(() => window.canvasRegression.settleFrames());
}
async function position(page: Page, point: [number, number]) {
  const p = await page.evaluate(
    (point) => window.canvasRegression.viewportPoint('left', 'bend', point),
    point,
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  return { x: box.x + p.x, y: box.y + p.y };
}
async function selectVertex(page: Page, index = 1) {
  const n = await node(page);
  const p = await position(page, [n.vertices[index].x, n.vertices[index].y]);
  await page.mouse.move(p.x, p.y);
  await frame(page);
  await page.mouse.click(p.x, p.y, { delay: 40 });
  await frame(page);
}
async function prepare(page: Page, n = network()) {
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    n,
  );
  await frame(page);
  const p = await position(page, [30, 80]);
  await page.mouse.dblclick(p.x, p.y, { delay: 60 });
  await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'bend'),
  );
  await page.getByRole('radio', { name: 'Bend', exact: true }).click();
  await expect(couplingPicker(page).locator('button')).toBeVisible();
  // The editor's double-click detector uses a 300ms interval between presses.
  await page.waitForTimeout(310);
  await selectVertex(page);
  await expect(couplingPicker(page).locator('button')).toBeEnabled();
}
async function dragHandle(
  page: Page,
  target: [number, number],
  release = true,
) {
  const n = await node(page);
  const anchor = n.vertices[1];
  const tangent = n.segments[1].tangentStart ?? { x: 35, y: 0 };
  const start = await position(page, [
    anchor.x + tangent.x,
    anchor.y + tangent.y,
  ]);
  const end = await position(page, [
    anchor.x + target[0],
    anchor.y + target[1],
  ]);
  await page.mouse.move(start.x, start.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await frame(page);
  if (release) {
    await page.mouse.up();
    await frame(page);
  }
}
const close = (
  actual: { x: number; y: number },
  expected: [number, number],
  tolerance = 1.5,
) => {
  expect(Math.abs(actual.x - expected[0])).toBeLessThan(tolerance);
  expect(Math.abs(actual.y - expected[1])).toBeLessThan(tolerance);
};
async function anchors(page: Page) {
  const n = await node(page);
  return Promise.all(n.vertices.map((v) => position(page, [v.x, v.y])));
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

for (const mode of ['NONE', 'ANGLE', 'ANGLE_AND_LENGTH']) {
  test(`drags ${mode} handles with stable anchors and one undo step`, async ({
    page,
  }) => {
    await prepare(page);
    await selectCoupling(page, mode);
    await frame(page);
    const before = await node(page);
    const points = await anchors(page);
    await dragHandle(page, [30, -40]);
    const after = await node(page);
    close(after.segments[1].tangentStart!, [30, -40]);
    if (mode === 'NONE')
      expect(after.segments[0].tangentEnd).toEqual(
        before.segments[0].tangentEnd,
      );
    else if (mode === 'ANGLE') {
      expect(
        Math.hypot(
          after.segments[0].tangentEnd!.x,
          after.segments[0].tangentEnd!.y,
        ),
      ).toBeCloseTo(30, 3);
      close(after.segments[0].tangentEnd!, [-18, 24]);
    } else close(after.segments[0].tangentEnd!, [-30, 40]);
    const moved = await anchors(page);
    moved.forEach((p, i) => close(p, [points[i].x, points[i].y], 0.01));
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await expect
      .poll(() => node(page).then((n) => n.segments))
      .toEqual(before.segments);
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await expect
      .poll(() => node(page).then((n) => n.segments))
      .toEqual(after.segments);
    expect(
      await page.evaluate(
        () => window.canvasRegression.state('right')!.nodes[0].type,
      ),
    ).toBe('rect');
  });
}

test('keeps rotated, reflected and scaled anchors fixed when bounds are rebased', async ({
  page,
}) => {
  const n = network();
  Object.assign(n, { x: 245, y: 40, rotation: 0.45, scaleX: -1, scaleY: 0.75 });
  await prepare(page, n);
  await selectCoupling(page, 'ANGLE_AND_LENGTH');
  await frame(page);
  const points = await anchors(page);
  await dragHandle(page, [30, -30]);
  const after = await node(page);
  close(after.segments[1].tangentStart!, [30, -30], 2);
  const moved = await anchors(page);
  moved.forEach((p, i) => close(p, [points[i].x, points[i].y], 0.02));
});

test('Alt drag breaks the coupling and the whole edit is undoable', async ({
  page,
}) => {
  await prepare(page);
  await selectCoupling(page, 'ANGLE_AND_LENGTH');
  await frame(page);
  const before = await node(page);
  await page.keyboard.down('Alt');
  await dragHandle(page, [30, -40]);
  await page.keyboard.up('Alt');
  const after = await node(page);
  expect(after.vertices[1].handleMirroring).toBe('NONE');
  expect(after.segments[0].tangentEnd).toEqual(before.segments[0].tangentEnd);
  close(after.segments[1].tangentStart!, [30, -40]);
  await expect(couplingPicker(page)).toHaveJSProperty('value', 'NONE');
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect
    .poll(() => node(page).then((n) => n.vertices[1].handleMirroring))
    .toBe('ANGLE_AND_LENGTH');
});

for (const cancel of [
  'Escape',
  'pointercancel',
  'pointerleave',
  'tool switch',
]) {
  test(`rolls back a ${cancel} drag`, async ({ page }) => {
    await prepare(page);
    await selectCoupling(page, 'ANGLE_AND_LENGTH');
    await frame(page);
    const before = await node(page);
    await dragHandle(page, [30, -40], false);
    await expect
      .poll(() => node(page).then((n) => n.segments))
      .not.toEqual(before.segments);
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else if (cancel === 'tool switch') {
      await page.evaluate(() =>
        window.canvasRegression.setPen('left', 'draw-rect' as Pen),
      );
    } else
      await page
        .locator('#left canvas')
        .dispatchEvent(cancel, { pointerId: 1, pointerType: 'mouse' });
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
}

test('disables coupling at branch vertices', async ({ page }) => {
  await prepare(page);
  const n = await node(page);
  await page.evaluate(
    (n) =>
      window.canvasRegression.update('left', 'bend', {
        vertices: [...n.vertices, { x: 80, y: 140 }],
        segments: [
          ...n.segments,
          { start: 1, end: 3, tangentStart: { x: 0, y: 20 } },
        ],
      }),
    n,
  );
  await frame(page);
  await expect(couplingPicker(page).locator('button')).toBeDisabled();
  await dragHandle(page, [30, -40]);
  const after = await node(page);
  expect(after.segments[2].tangentStart).toEqual({ x: 0, y: 20 });
  expect(after.segments[0].tangentEnd).toEqual(n.segments[0].tangentEnd);
});

test('creates a curve from the incoming handle of a straight edge', async ({
  page,
}) => {
  const n = network();
  n.segments = [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ];
  await prepare(page, n);
  const start = await position(page, [52, 80]);
  const end = await position(page, [60, 45]);
  await page.mouse.move(start.x, start.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await frame(page);
  await page.mouse.up();
  await frame(page);
  const after = await node(page);
  close(after.segments[0].tangentEnd!, [-20, -35]);
  expect(after.segments[1].tangentStart).toBeUndefined();
  await page.screenshot({ path: '/tmp/vector-bend-final.png' });
});

for (const kind of ['straight', 'cubic', 'transformed', 'cancel']) {
  test(`bends a ${kind} edge directly with fixed anchors`, async ({ page }) => {
    const n = network();
    n.version = 1;
    n.vertices = [
      { x: 0, y: 80 },
      { x: 180, y: 80 },
    ];
    n.segments = [{ start: 0, end: 1 }];
    if (kind === 'cubic')
      Object.assign(n.segments[0], {
        tangentStart: { x: 45, y: -20 },
        tangentEnd: { x: -45, y: 20 },
      });
    if (kind === 'transformed')
      Object.assign(n, {
        x: 245,
        y: 40,
        rotation: 0.45,
        scaleX: -1,
        scaleY: 0.75,
      });
    await page.evaluate(
      (n) => window.canvasRegression.setScene('left', [n], n.id),
      n,
    );
    await frame(page);
    const onCurve = pointOnVectorCubic(
      vectorSegmentCubic(n.vertices, n.segments[0])!,
      0.35,
    );
    const start = await position(page, onCurve);
    await page.mouse.dblclick(start.x, start.y, { delay: 60 });
    await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
    await page.evaluate(() =>
      window.canvasRegression.vectorToolbar('left', 'bend'),
    );
    await page.getByRole('radio', { name: 'Bend', exact: true }).click();
    await expect(couplingPicker(page).locator('button')).toBeVisible();
    const before = await node(page),
      fixed = await anchors(page);
    const end = await position(page, [onCurve[0], onCurve[1] - 35]);
    await page.mouse.move(start.x, start.y);
    await frame(page);
    await page.mouse.down();
    await frame(page);
    await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, {
      steps: 4,
    });
    await frame(page);
    const midwayVersion = (await node(page)).version;
    await page.mouse.move(end.x, end.y, { steps: 4 });
    await frame(page);
    const finalVersion = (await node(page)).version;
    expect(finalVersion).toBeGreaterThan(midwayVersion);
    await frame(page);
    expect((await node(page)).version).toBe(finalVersion);
    if (kind === 'cancel') await page.keyboard.press('Escape');
    await page.mouse.up();
    await frame(page);
    const after = await node(page);
    if (kind === 'cancel') {
      expect(after.segments).toEqual(before.segments);
      expect(after.vertices).toEqual(before.vertices);
      return;
    }
    const grabbed = pointOnVectorCubic(
      vectorSegmentCubic(after.vertices, after.segments[0])!,
      0.35,
    );
    const p = await position(page, grabbed);
    close(p, [end.x, end.y], 2);
    const points = await anchors(page);
    points.forEach((p, i) => close(p, [fixed[i].x, fixed[i].y], 0.02));
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await expect
      .poll(() => node(page).then((n) => n.segments))
      .toEqual(before.segments);
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await expect
      .poll(() => node(page).then((n) => n.segments))
      .toEqual(after.segments);
    if (kind === 'cubic')
      await page.screenshot({ path: '/tmp/vector-curve-bend.png' });
  });
}

test('commits curve bending and its new crossings as one undo step', async ({
  page,
}) => {
  const n = network();
  n.vertices = [
    { x: 0, y: 80 },
    { x: 180, y: 80 },
    { x: 0, y: 50 },
    { x: 180, y: 50 },
  ];
  n.segments = [
    { start: 0, end: 1 },
    { start: 2, end: 3 },
  ];
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    n,
  );
  await frame(page);
  const start = await position(page, [90, 80]);
  await page.mouse.dblclick(start.x, start.y, { delay: 60 });
  await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'bend'),
  );
  await page.getByRole('radio', { name: 'Bend', exact: true }).click();
  await expect(couplingPicker(page).locator('button')).toBeVisible();
  const before = await node(page),
    fixed = await anchors(page);
  const end = await position(page, [90, 30]);
  await page.mouse.move(start.x, start.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await frame(page);
  expect((await node(page)).segments).toHaveLength(2);
  await page.mouse.up();
  await frame(page);
  const after = await node(page);
  expect(after.segments).toHaveLength(6);
  expect(after.vertices).toHaveLength(6);
  const points = await anchors(page);
  points
    .slice(0, 4)
    .forEach((p, i) => close(p, [fixed[i].x, fixed[i].y], 0.02));
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect
    .poll(() => node(page).then((n) => n.segments))
    .toEqual(before.segments);
  expect((await node(page)).vertices).toEqual(before.vertices);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect
    .poll(() => node(page).then((n) => n.segments))
    .toEqual(after.segments);
});

test('clicking a virtual straight-edge handle does not create curvature', async ({
  page,
}) => {
  const n = network();
  n.segments = [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ];
  await prepare(page, n);
  const before = await node(page);
  const handle = await position(page, [52, 80]);
  await page.mouse.move(handle.x, handle.y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.up();
  await frame(page);
  expect((await node(page)).segments).toEqual(before.segments);
  expect((await node(page)).vertices).toEqual(before.vertices);
});
