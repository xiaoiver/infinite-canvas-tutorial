import { expect, test, type Page } from '@playwright/test';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

const square = (): VectorNetworkSerializedNode => ({
  id: 'network',
  type: 'vector-network',
  x: 40,
  y: 40,
  width: 140,
  height: 140,
  zIndex: 1,
  vertices: [
    { x: 0, y: 0 },
    { x: 140, y: 0 },
    { x: 140, y: 140 },
    { x: 0, y: 140 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
  ],
  regions: [],
  fills: [{ type: 'solid', value: '#ff0000' }],
  strokes: [{ type: 'solid', value: '#000000' }],
  strokeWidth: 2,
});

async function viewport(page: Page, point: [number, number]) {
  const local = await page.evaluate(
    (point) => window.canvasRegression.viewportPoint('left', 'network', point),
    point,
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  return { x: box.x + local.x, y: box.y + local.y };
}

async function move(page: Page, point: [number, number]) {
  const screen = await viewport(page, point);
  await page.mouse.move(screen.x, screen.y);
}

async function click(page: Page, point: [number, number]) {
  const screen = await viewport(page, point);
  await page.mouse.click(screen.x, screen.y, { delay: 40 });
}

async function frame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function prepare(page: Page, node: VectorNetworkSerializedNode) {
  await page.evaluate(
    (node) => window.canvasRegression.setScene('left', [node], node.id),
    node,
  );
  // Scene writes run at the end of a tick; let transforms and picking catch up.
  await frame(page);
  // Enter edit through the production double-click handler, then use the real toolbar.
  const point = await viewport(page, [70, 0]);
  await page.mouse.dblclick(point.x, point.y, { delay: 60 });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.canvasRegression.state('left')!.nodes[0].isEditing,
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'network'),
  );
  await page.getByRole('radio', { name: 'Fill region', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.canvasRegression.state('left')!.state.vectorNetworkEditMode,
      ),
    )
    .toBe('fill');
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.visibleVectorAnchors('left')),
    )
    .toBe(0);
}

const regions = (page: Page) =>
  page.evaluate(
    () =>
      (
        window.canvasRegression.state('left')!
          .nodes[0] as VectorNetworkSerializedNode
      ).regions,
  );

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

test('previews, fills and clears individual faces with one undo step per click', async ({
  page,
}) => {
  const node = square();
  node.segments.push({ start: 0, end: 2 });
  await prepare(page, node);
  await move(page, [100, 30]);
  await expect(
    page.locator('[data-vector-network-fill-preview]'),
  ).toBeVisible();
  expect(await regions(page)).toEqual([]);
  // Hidden handles must also leave the GPU draw list, not only ECS visibility.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = window.canvasRegression;
        // Allow antialiasing against the grid, but reject the white/blue handle.
        return h
          .pixel('left', 40, 110)
          .slice(0, 3)
          .every((value) => value < 128);
      }),
    )
    .toBe(true);
  await page.screenshot({ path: test.info().outputPath('fill-preview.png') });
  await click(page, [100, 30]);
  await expect.poll(() => regions(page)).toHaveLength(1);
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.pixel('left', 140, 70)),
    )
    .toEqual([255, 0, 0, 255]);
  await click(page, [30, 100]);
  await expect.poll(() => regions(page)).toHaveLength(2);
  await click(page, [100, 30]);
  await expect.poll(() => regions(page)).toHaveLength(1);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(() => regions(page)).toHaveLength(2);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect.poll(() => regions(page)).toHaveLength(1);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('right')!.nodes[0].type,
    ),
  ).toBe('rect');
  expect(
    await page.evaluate(() => window.canvasRegression.pixel('right', 80, 80)),
  ).toEqual([255, 0, 0, 255]);
});

test('fills an outer ring without painting its hole, then fills the inner face separately', async ({
  page,
}) => {
  const node = square();
  node.vertices.push(
    { x: 40, y: 40 },
    { x: 100, y: 40 },
    { x: 100, y: 100 },
    { x: 40, y: 100 },
  );
  node.segments.push(
    { start: 4, end: 5 },
    { start: 5, end: 6 },
    { start: 6, end: 7 },
    { start: 7, end: 4 },
  );
  await prepare(page, node);
  const background = await page.evaluate(() =>
    window.canvasRegression.pixel('left', 110, 110),
  );
  await click(page, [20, 70]);
  await expect.poll(() => regions(page)).toHaveLength(1);
  expect((await regions(page))![0].loops).toHaveLength(2);
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.pixel('left', 60, 110)),
    )
    .toEqual([255, 0, 0, 255]);
  expect(
    await page.evaluate(() => window.canvasRegression.pixel('left', 110, 110)),
  ).toEqual(background);
  await click(page, [70, 70]);
  await expect.poll(() => regions(page)).toHaveLength(2);
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.pixel('left', 110, 110)),
    )
    .toEqual([255, 0, 0, 255]);
});

test('uses transformed local coordinates and gives a stroke-only network visible paint', async ({
  page,
}) => {
  const node = square();
  Object.assign(node, {
    x: 230,
    y: 45,
    rotation: 0.25,
    scaleX: -0.8,
    scaleY: 0.7,
    fills: [],
  });
  await prepare(page, node);
  const before = await page.evaluate(
    () => window.canvasRegression.state('left')!.nodes[0],
  );
  await click(page, [70, 70]);
  await expect.poll(() => regions(page)).toHaveLength(1);
  const after = await page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes[0] as VectorNetworkSerializedNode,
  );
  expect(after.fills![0].value).toBe('#147af3');
  for (const key of [
    'x',
    'y',
    'rotation',
    'scaleX',
    'scaleY',
    'vertices',
    'segments',
  ]) {
    expect(after[key]).toEqual(before[key]);
  }
});

test('cancels drags and pointer cancellation and clears previews on exit and destruction', async ({
  page,
}) => {
  await prepare(page, square());
  await move(page, [50, 50]);
  await expect(
    page.locator('[data-vector-network-fill-preview]'),
  ).toBeVisible();
  await page.mouse.down();
  await move(page, [100, 50]);
  await page.mouse.up();
  await frame(page);
  expect(await regions(page)).toEqual([]);
  await page.mouse.down();
  await page
    .locator('#left canvas')
    .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  await frame(page);
  expect(await regions(page)).toEqual([]);
  await page.mouse.move(10, 10);
  await expect(
    page.locator('[data-vector-network-fill-preview]'),
  ).not.toBeVisible();
  await move(page, [50, 50]);
  await expect(
    page.locator('[data-vector-network-fill-preview]'),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Move', exact: true }).click();
  await expect(page.locator('[data-vector-network-fill-preview]')).toHaveCount(
    0,
  );
  await page.getByRole('radio', { name: 'Fill region', exact: true }).click();
  await move(page, [50, 50]);
  await expect(
    page.locator('[data-vector-network-fill-preview]'),
  ).toBeVisible();
  await page.evaluate(() => window.canvasRegression.destroy('left'));
  await expect(page.locator('[data-vector-network-fill-preview]')).toHaveCount(
    0,
  );
});

for (const exit of ['Escape', 'toolbar'] as const) {
  test(`exits Fill through ${exit} without changing the document`, async ({
    page,
  }) => {
    await prepare(page, square());
    await move(page, [50, 50]);
    await expect(
      page.locator('[data-vector-network-fill-preview]'),
    ).toBeVisible();
    if (exit === 'Escape') {
      await page.locator('#left canvas').focus();
      await page.keyboard.press('Escape');
    } else {
      await page
        .getByRole('button', { name: 'Exit vector edit', exact: true })
        .click();
    }
    await expect
      .poll(() =>
        page.evaluate(
          () => window.canvasRegression.state('left')!.nodes[0].isEditing,
        ),
      )
      .toBe(false);
    await expect(
      page.locator('[data-vector-network-fill-preview]'),
    ).toHaveCount(0);
    expect(await regions(page)).toEqual([]);
  });
}

test('previews unsplit crossings and commits topology only when filling a face', async ({
  page,
}) => {
  const n = square();
  n.vertices.push({ x: -20, y: 70 }, { x: 160, y: 70 });
  n.segments.push({ start: 4, end: 5 });
  await prepare(page, n);
  await move(page, [70, 35]);
  await expect(
    page.locator('[data-vector-network-fill-preview]'),
  ).toBeVisible();
  const current = () =>
    page.evaluate(
      () =>
        window.canvasRegression.state('left')!
          .nodes[0] as VectorNetworkSerializedNode,
    );
  expect((await current()).segments).toHaveLength(5);
  await click(page, [70, 35]);
  await expect.poll(async () => (await current()).segments.length).toBe(9);
  expect((await current()).vertices).toHaveLength(8);
  expect((await regions(page))!.length).toBe(1);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(async () => (await current()).segments.length).toBe(5);
  expect((await regions(page))!.length).toBe(0);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect.poll(async () => (await current()).segments.length).toBe(9);
});
