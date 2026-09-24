import { expect, test, type Page } from '@playwright/test';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';
declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const shape = (): VectorNetworkSerializedNode => ({
  id: 'face',
  type: 'vector-network',
  version: 1,
  zIndex: 1,
  x: 40,
  y: 30,
  width: 180,
  height: 180,
  vertices: [
    { x: 0, y: 0 },
    { x: 180, y: 0 },
    { x: 180, y: 180 },
    { x: 0, y: 180 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 },
    { start: 3, end: 0 },
  ],
  regions: [{ fillRule: 'evenodd', loops: [[0, 1, 2, 3]] }],
  strokes: [{ type: 'solid', value: '#147af3' }],
  fills: [{ type: 'solid', value: '#b7d6ff' }],
  strokeWidth: 2,
});
const node = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes[0] as VectorNetworkSerializedNode,
  );
const geometry = async (page: Page) => {
  const n = await node(page);
  return [n.x, n.y, n.vertices, n.segments, n.regions];
};
const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const controls = (page: Page) =>
  page.locator('ic-spectrum-vector-topology-controls[faces]');
async function select(page: Page, index = 0) {
  // Coordinate clicks do not auto-wait for Spectrum's closing overlay animation.
  await expect(controls(page).locator('sp-popover')).toBeHidden();
  const p = await page.evaluate((index) => {
    const n = window.canvasRegression.state('left')!
      .nodes[0] as VectorNetworkSerializedNode;
    const v = n.vertices[index];
    return window.canvasRegression.viewportPoint('left', 'face', [v.x, v.y]);
  }, index);
  const b = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(b.x + p.x, b.y + p.y);
  await frame(page);
  await page.mouse.click(b.x + p.x, b.y + p.y, { delay: 60 });
  await frame(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.canvasRegression.state('left')!.state
            .vectorNetworkSelectedVertex?.index,
      ),
    )
    .toBe(index);
}
async function open(page: Page) {
  await controls(page)
    .getByRole('button', { name: 'Cut / Uncut faces', exact: true })
    .click();
  await expect(page.locator('[data-vector-topology-preview]')).toBeVisible();
}
async function choose(page: Page, label: string, option: string) {
  await controls(page).locator(`sp-picker[label="${label}"]`).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function cut(page: Page) {
  await open(page);
  await choose(page, 'Target vertex', 'V3');
  await controls(page)
    .getByRole('button', { name: 'Cut face', exact: true })
    .click();
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(5);
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(
    (n) => window.canvasRegression.setScene('left', [n], n.id),
    shape(),
  );
  await frame(page);
  const b = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(b.x + 100, b.y + 30);
  await frame(page);
  await page.mouse.dblclick(b.x + 100, b.y + 30, { delay: 60 });
  await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'face'),
  );
  await select(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});
for (const transformed of [false, true])
  test(`cuts and uncuts a filled face atomically, transformed=${transformed}`, async ({
    page,
  }) => {
    if (transformed) {
      await page.evaluate(() =>
        window.canvasRegression.update('left', 'face', {
          x: 260,
          y: 60,
          rotation: 0.35,
          scaleX: -0.8,
          scaleY: 1.1,
        }),
      );
      await frame(page);
      await select(page);
    }
    const before = await geometry(page);
    await cut(page);
    const split = await geometry(page);
    expect((await node(page)).regions).toHaveLength(2);
    await open(page);
    await choose(page, 'Face operation', 'Uncut edge');
    await choose(page, 'Shared edge', 'E5');
    await controls(page)
      .getByRole('button', { name: 'Uncut edge', exact: true })
      .click();
    await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(4);
    expect((await node(page)).regions).toHaveLength(1);
    const merged = await geometry(page);
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await expect.poll(() => geometry(page)).toEqual(split);
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await expect.poll(() => geometry(page)).toEqual(before);
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await expect.poll(() => geometry(page)).toEqual(split);
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await expect.poll(() => geometry(page)).toEqual(merged);
  });
test('rejects unequal fill states without writing geometry or history', async ({
  page,
}) => {
  await cut(page);
  const regions = (await node(page)).regions!;
  await page.evaluate(
    (regions) => window.canvasRegression.update('left', 'face', { regions }),
    regions.slice(0, 1),
  );
  await frame(page);
  await select(page);
  const before = await geometry(page);
  await open(page);
  await choose(page, 'Face operation', 'Uncut edge');
  await choose(page, 'Shared edge', 'E5');
  await controls(page)
    .getByRole('button', { name: 'Uncut edge', exact: true })
    .click();
  await expect(controls(page).getByRole('alert')).toContainText(
    'same fill state',
  );
  expect(await geometry(page)).toEqual(before);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  expect((await node(page)).regions).toHaveLength(2);
  expect((await node(page)).segments).toHaveLength(5);
});
test('keeps an invalid cut reviewable, accepts a corrected target, and cancels on narrow screens', async ({
  page,
}) => {
  await open(page);
  const before = await geometry(page);
  await choose(page, 'Target vertex', 'V2');
  await controls(page)
    .getByRole('button', { name: 'Cut face', exact: true })
    .click();
  await expect(controls(page).getByRole('alert')).toContainText('same face');
  expect(await geometry(page)).toEqual(before);
  await choose(page, 'Target vertex', 'V3');
  await expect(controls(page).getByRole('alert')).toHaveCount(0);
  await controls(page)
    .getByRole('button', { name: 'Cut face', exact: true })
    .click();
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect
    .poll(async () => {
      const b = await controls(page)
        .locator('sp-popover')
        .first()
        .boundingBox();
      return !!b && b.x >= 0 && b.x + b.width <= 390;
    })
    .toBe(true);
  const split = await geometry(page);
  await controls(page)
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  expect(await geometry(page)).toEqual(split);
});

for (const mobile of [false, true])
  test(`opens, splits and restores a hole with atomic history, mobile=${mobile}`, async ({
    page,
  }) => {
    const n = shape();
    n.vertices.push(
      { x: 54, y: 54 },
      { x: 126, y: 54 },
      { x: 126, y: 126 },
      { x: 54, y: 126 },
    );
    n.segments.push(
      { start: 4, end: 5 },
      { start: 5, end: 6 },
      { start: 6, end: 7 },
      { start: 7, end: 4 },
    );
    n.regions![0].loops = [...n.regions![0].loops, [4, 5, 6, 7]];
    await page.evaluate(
      (n) =>
        window.canvasRegression.update('left', 'face', {
          vertices: n.vertices,
          segments: n.segments,
          regions: n.regions,
          ...(n.rotation
            ? {
                x: n.x,
                y: n.y,
                rotation: n.rotation,
                scaleX: n.scaleX,
                scaleY: n.scaleY,
              }
            : {}),
        }),
      mobile
        ? n
        : { ...n, x: 260, y: 60, rotation: 0.35, scaleX: -0.8, scaleY: 1.1 },
    );
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await frame(page);
    await select(page);
    const states = [await geometry(page)];
    await open(page);
    await choose(page, 'Target vertex', 'V5');
    await controls(page)
      .getByRole('button', { name: 'Cut face', exact: true })
      .click();
    await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(9);
    expect((await node(page)).regions).toHaveLength(1);
    expect((await node(page)).regions![0].loops).toHaveLength(1);
    expect(
      (await node(page)).regions![0].loops[0].filter((e) => e === 8),
    ).toHaveLength(2);
    states.push(await geometry(page));
    await select(page, 1);
    await open(page);
    await choose(page, 'Target vertex', 'V6');
    await controls(page)
      .getByRole('button', { name: 'Cut face', exact: true })
      .click();
    await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(10);
    expect((await node(page)).regions).toHaveLength(2);
    states.push(await geometry(page));
    for (const [vertex, edge, count] of [
      [1, 'E10', 9],
      [0, 'E9', 8],
    ] as const) {
      await select(page, vertex);
      await open(page);
      await choose(page, 'Face operation', 'Uncut edge');
      await choose(page, 'Shared edge', edge);
      await controls(page)
        .getByRole('button', { name: 'Uncut edge', exact: true })
        .click();
      await expect
        .poll(() => node(page).then((n) => n.segments.length))
        .toBe(count);
      states.push(await geometry(page));
    }
    expect((await node(page)).regions).toHaveLength(1);
    expect((await node(page)).regions![0].loops).toHaveLength(2);
    expect((await node(page)).segments).toEqual(n.segments);
    for (let i = states.length - 2; i >= 0; i--) {
      await page.evaluate(() => window.canvasRegression.undo('left'));
      await expect.poll(() => geometry(page)).toEqual(states[i]);
    }
    for (const state of states.slice(1)) {
      await page.evaluate(() => window.canvasRegression.redo('left'));
      await expect.poll(() => geometry(page)).toEqual(state);
    }
  });
