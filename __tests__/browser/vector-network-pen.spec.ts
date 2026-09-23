import { expect, test, type Page } from '@playwright/test';
import type { Pen } from '../../packages/ecs/src/components/Canvas';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const preview = '[data-vector-network-pen-preview]';
const nodes = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes as VectorNetworkSerializedNode[],
  );
async function frame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function move(page: Page, x: number, y: number) {
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + x, box.y + y);
  await frame(page);
}
async function click(page: Page, x: number, y: number) {
  await move(page, x, y);
  await page.mouse.down();
  await frame(page);
  await page.mouse.up();
  await frame(page);
}
async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await move(page, x, y);
  await page.mouse.down();
  await frame(page);
  await move(page, dx, dy);
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
  await page.evaluate(() => window.canvasRegression.setScene('left', [], ''));
  await page.evaluate(
    (pen) => window.canvasRegression.setPen('left', pen),
    'vector-network' as Pen,
  );
  await frame(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('previews exact cubic controls, continues smooth curves and records one step per edge', async ({
  page,
}) => {
  await drag(page, 40, 100, 70, 70);
  await expect(
    page.locator(`${preview} [data-pen-part="handles"]`),
  ).toBeVisible();
  expect(await nodes(page)).toEqual([]);
  await page.mouse.up();
  await frame(page);
  await move(page, 40, 100);
  await expect(page.locator(`${preview} [data-pen-part="curve"]`)).toHaveCount(
    0,
  );
  await drag(page, 140, 100, 170, 70);
  const d = await page
    .locator(`${preview} [data-pen-part="curve"]`)
    .getAttribute('d');
  expect(d!.match(/-?\d+(?:\.\d+)?/g)!.map(Number)).toEqual(
    [40, 100, 70, 70, 110, 130, 140, 100].map((n) => expect.closeTo(n, 4)),
  );
  expect(await nodes(page)).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('pen-preview.png') });
  await page.mouse.up();
  await frame(page);
  await expect.poll(() => nodes(page).then((n) => n.length)).toBe(1);
  let node = (await nodes(page))[0];
  expect(Number.isFinite(node.version)).toBe(true);
  const firstVersion = node.version!;
  expect(node.segments[0].tangentStart).toEqual({
    x: expect.closeTo(30, 4),
    y: expect.closeTo(-30, 4),
  });
  expect(node.segments[0].tangentEnd).toEqual({
    x: expect.closeTo(-30, 4),
    y: expect.closeTo(30, 4),
  });
  expect(node.vertices.map((v) => [v.x + node.x!, v.y + node.y!])).toEqual([
    [expect.closeTo(40, 4), expect.closeTo(100, 4)],
    [expect.closeTo(140, 4), expect.closeTo(100, 4)],
  ]);
  await click(page, 240, 100);
  node = (await nodes(page))[0];
  expect(node.segments).toHaveLength(2);
  expect(node.version).toBeGreaterThan(firstVersion);
  expect(node.segments[1].tangentStart).toEqual({
    x: expect.closeTo(30, 4),
    y: expect.closeTo(-30, 4),
  });
  expect(node.segments[1].tangentEnd).toBeUndefined();
  await page.keyboard.press('Enter');
  await frame(page);
  await expect(page.locator(preview)).toHaveCount(0);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect
    .poll(() => nodes(page).then((n) => n[0]?.segments.length))
    .toBe(1);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(() => nodes(page)).toEqual([]);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect
    .poll(() => nodes(page).then((n) => n[0]?.segments.length))
    .toBe(1);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('right')!.nodes[0].type,
    ),
  ).toBe('rect');
});

test('closes a network by reusing its starting vertex and preserves closure through history', async ({
  page,
}) => {
  await click(page, 60, 60);
  await click(page, 160, 60);
  await click(page, 160, 160);
  await click(page, 62, 61);
  const node = (await nodes(page))[0];
  expect(node.vertices).toHaveLength(3);
  expect(node.segments).toEqual([
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 0 },
  ]);
  expect(node.regions).toHaveLength(1);
  await expect(page.locator(preview)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('left')!.state.penbarSelected,
    ),
  ).toBe('select');
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect
    .poll(() => nodes(page).then((n) => n[0]?.segments.length))
    .toBe(2);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect
    .poll(() => nodes(page).then((n) => n[0]?.regions?.length))
    .toBe(1);
});

test('cancels interrupted gestures and drops an uncommitted first anchor on Escape', async ({
  page,
}) => {
  await drag(page, 40, 100, 70, 70);
  await page
    .locator('#left canvas')
    .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
  await page.mouse.up();
  await frame(page);
  expect(await nodes(page)).toEqual([]);
  await click(page, 40, 100);
  await drag(page, 140, 100, 170, 70);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await frame(page);
  expect(await nodes(page)).toEqual([]);
  await expect(page.locator(preview)).toHaveCount(0);
});

test('uses the pressed anchor for snapping even if its handle is dragged away', async ({
  page,
}) => {
  await drag(page, 60, 100, 60, 60);
  await page.mouse.up();
  await frame(page);
  await click(page, 160, 60);
  await click(page, 160, 160);
  await drag(page, 60, 100, 30, 100);
  await page.mouse.up();
  await frame(page);
  const node = (await nodes(page))[0];
  expect(node.vertices).toHaveLength(3);
  expect(node.segments).toHaveLength(3);
  expect(node.segments[2].end).toBe(0);
  expect(node.segments[0].tangentStart).toEqual({
    x: expect.closeTo(-30, 4),
    y: expect.closeTo(0, 4),
  });
  expect(node.segments[2].tangentEnd).toEqual({
    x: expect.closeTo(30, 4),
    y: expect.closeTo(0, 4),
  });
});

test('undo during drawing abandons stale continuation and switching tools removes preview', async ({
  page,
}) => {
  await click(page, 40, 60);
  await click(page, 140, 60);
  await click(page, 140, 160);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  await click(page, 220, 60);
  await click(page, 260, 160);
  expect((await nodes(page)).map((n) => n.segments.length)).toEqual([1, 1]);
  await page.evaluate(
    (pen) => window.canvasRegression.setPen('left', pen),
    'select' as Pen,
  );
  await expect(page.locator(preview)).toHaveCount(0);
});

test('destroying one canvas removes its pen preview', async ({ page }) => {
  await click(page, 40, 60);
  await move(page, 140, 60);
  await expect(page.locator(preview)).toBeVisible();
  await page.evaluate(() => window.canvasRegression.destroy('left'));
  await expect(page.locator(preview)).toHaveCount(0);
  expect(
    await page.evaluate(() => window.canvasRegression.state('right')!.gpu),
  ).toBe(true);
});

for (const zoom of [0.5, 2]) {
  test(`snaps within ten viewport pixels at zoom ${zoom}`, async ({ page }) => {
    await page.evaluate(
      (zoom) => window.canvasRegression.setZoom('left', zoom),
      zoom,
    );
    await frame(page);
    await click(page, 60, 60);
    await click(page, 160, 60);
    await click(page, 160, 160);
    await click(page, 67, 60);
    const node = (await nodes(page))[0];
    expect(node.vertices).toHaveLength(3);
    expect(node.segments[2].end).toBe(0);
    expect(node.regions).toHaveLength(1);
  });
}

test('ignores a cancelled press coalesced into one frame and a drag leaving the canvas', async ({
  page,
}) => {
  await click(page, 40, 60);
  await page.locator('#left canvas').evaluate((canvas) => {
    const box = canvas.getBoundingClientRect();
    const data = {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: box.x + 140,
      clientY: box.y + 60,
    };
    for (const type of ['pointerdown', 'pointercancel', 'pointerup'])
      canvas.dispatchEvent(new PointerEvent(type, data));
  });
  await frame(page);
  expect(await nodes(page)).toEqual([]);
  await drag(page, 140, 60, 170, 60);
  await page.mouse.move(10, 10);
  await page.mouse.up();
  await frame(page);
  expect(await nodes(page)).toEqual([]);
  await move(page, 140, 60);
  await expect(page.locator(preview)).toBeVisible();
  await click(page, 140, 60);
  expect((await nodes(page))[0].segments).toHaveLength(1);
});

test('closes a two-anchor curved loop without rejecting distinct parallel edges', async ({
  page,
}) => {
  await click(page, 80, 100);
  await click(page, 180, 100);
  await drag(page, 80, 100, 80, 40);
  await page.mouse.up();
  await frame(page);
  const node = (await nodes(page))[0];
  expect(node.vertices).toHaveLength(2);
  expect(node.segments).toHaveLength(2);
  expect(node.regions).toHaveLength(1);
  expect(node.regions![0].loops[0]).toHaveLength(2);
});

test('splits a pen crossing into a shared junction in the same undo step', async ({
  page,
}) => {
  await click(page, 40, 40);
  await click(page, 180, 180);
  await click(page, 40, 180);
  const before = (await nodes(page))[0];
  await click(page, 180, 40);
  const after = (await nodes(page))[0];
  expect(after.vertices).toHaveLength(5);
  expect(after.segments).toHaveLength(5);
  expect(
    after.segments.filter((s) => s.start === 4 || s.end === 4),
  ).toHaveLength(4);
  // The next segment must still start at the clicked endpoint, not the junction.
  await click(page, 260, 40);
  expect(
    (await nodes(page))[0].segments.some((s) => s.start === 3 && s.end === 5),
  ).toBe(true);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await frame(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect
    .poll(async () => (await nodes(page))[0].segments)
    .toEqual(before.segments);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect
    .poll(async () => (await nodes(page))[0].segments)
    .toEqual(after.segments);
});
