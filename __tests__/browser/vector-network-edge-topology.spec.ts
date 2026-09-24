import { expect, test, type Page } from '@playwright/test';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';
declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const shape = (): VectorNetworkSerializedNode => ({
  id: 'edge',
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
    { start: 0, end: 2 },
  ],
  regions: [
    { fillRule: 'evenodd', loops: [[0, 1, 4]] },
    { fillRule: 'evenodd', loops: [[4, 2, 3]] },
  ],
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
  page.locator('ic-spectrum-vector-topology-controls:not([faces])');
async function select(page: Page) {
  const p = await page.evaluate(() =>
    window.canvasRegression.viewportPoint('left', 'edge', [0, 0]),
  );
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
    .toBe(0);
}
async function open(page: Page) {
  await controls(page)
    .getByRole('button', { name: 'Glue / Unglue', exact: true })
    .click();
  await expect(page.locator('[data-vector-topology-preview]')).toBeVisible();
}
async function choose(page: Page, label: string, option: string) {
  await controls(page).locator(`sp-picker[label="${label}"]`).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function edgePanel(page: Page, source = 'E5') {
  await open(page);
  await choose(page, 'Topology target', 'Edges');
  await choose(page, 'Source edge', source);
}
async function unglue(page: Page) {
  await edgePanel(page);
  await expect(page.locator('[data-vector-topology-preview]')).toContainText(
    'R2',
  );
  await controls(page)
    .getByRole('checkbox', { name: 'R2 · L1 · 1', exact: true })
    .check();
  await controls(page)
    .getByRole('button', { name: 'Unglue edge', exact: true })
    .click();
  await expect.poll(() => node(page).then((n) => n.segments.length)).toBe(6);
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  await expect(
    page.getByRole('radio', { name: 'Bend', exact: true }),
  ).toBeChecked();
}
async function move(page: Page) {
  await page.getByRole('radio', { name: 'Move', exact: true }).click();
  await frame(page);
  await select(page);
}
async function bend(page: Page) {
  const n = await node(page),
    a = n.vertices[n.segments[4].start],
    b = n.vertices[n.segments[4].end];
  const p = await page.evaluate(
    ([x, y]) => window.canvasRegression.viewportPoint('left', 'edge', [x, y]),
    [(a.x + b.x) / 2, (a.y + b.y) / 2],
  );
  const box = (await page.locator('#left canvas').boundingBox())!;
  const x = box.x + p.x,
    y = box.y + p.y;
  await page.mouse.move(x, y);
  await frame(page);
  await page.mouse.down();
  await frame(page);
  await page.mouse.move(x + 18, y - 22, { steps: 8 });
  await frame(page);
  await page.mouse.up();
  await frame(page);
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
    window.canvasRegression.vectorToolbar('left', 'edge'),
  );
  await select(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('unglues and glues a shared edge with one undo step per operation', async ({
  page,
}) => {
  const before = await geometry(page);
  await unglue(page);
  const split = await geometry(page);
  expect((await node(page)).regions!.map((r) => r.loops)).toEqual([
    [[0, 1, 4]],
    [[5, 2, 3]],
  ]);
  await move(page);
  await edgePanel(page, 'E6');
  await choose(page, 'Edge operation', 'Glue edges');
  await choose(page, 'Target edge', 'E5');
  await controls(page)
    .getByRole('button', { name: 'Glue edges', exact: true })
    .click();
  await expect.poll(() => geometry(page)).toEqual(before);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(() => geometry(page)).toEqual(split);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(() => geometry(page)).toEqual(before);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect.poll(() => geometry(page)).toEqual(split);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect.poll(() => geometry(page)).toEqual(before);
});
for (const transformed of [false, true])
  test(`bends only the detached copy, transformed=${transformed}`, async ({
    page,
  }) => {
    if (transformed) {
      await page.evaluate(() =>
        window.canvasRegression.update('left', 'edge', {
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
    await unglue(page);
    const before = await node(page);
    await bend(page);
    const after = await node(page);
    expect(after.segments).toHaveLength(6);
    expect(after.segments[4]).toEqual(before.segments[4]);
    expect(after.segments[5]).not.toEqual(before.segments[5]);
    expect(after.regions).toEqual(before.regions);
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await expect
      .poll(() => node(page).then((n) => n.segments))
      .toEqual(before.segments);
  });
test('explicitly bends the original overlapping edge instead of the last stored copy', async ({
  page,
}) => {
  await unglue(page);
  await move(page);
  await edgePanel(page, 'E5');
  await controls(page)
    .getByRole('button', { name: 'Bend selected edge', exact: true })
    .click();
  await frame(page);
  const before = await node(page);
  await bend(page);
  const after = await node(page);
  expect(after.segments[4]).not.toEqual(before.segments[4]);
  expect(after.segments[5]).toEqual(before.segments[5]);
});
test('rejects different curves without writing history', async ({ page }) => {
  await unglue(page);
  await bend(page);
  await move(page);
  const before = await geometry(page);
  await edgePanel(page, 'E6');
  await choose(page, 'Edge operation', 'Glue edges');
  await choose(page, 'Target edge', 'E5');
  await controls(page)
    .getByRole('button', { name: 'Glue edges', exact: true })
    .click();
  await expect(controls(page).getByRole('alert')).toContainText(
    'matching curves',
  );
  expect(await geometry(page)).toEqual(before);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  expect((await node(page)).segments[5]).toEqual(
    (await node(page)).segments[4],
  );
});
test('disables empty and all-use unglue and cancels a mobile preview without changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await geometry(page);
  await edgePanel(page);
  const button = controls(page).getByRole('button', {
    name: 'Unglue edge',
    exact: true,
  });
  await expect(button).toBeDisabled();
  for (const checkbox of await controls(page).getByRole('checkbox').all())
    await checkbox.check();
  await expect(button).toBeDisabled();
  await expect
    .poll(async () => {
      const b = await controls(page)
        .locator('sp-popover')
        .first()
        .boundingBox();
      return !!b && b.x >= 0 && b.x + b.width <= 390;
    })
    .toBe(true);
  await controls(page)
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  expect(await geometry(page)).toEqual(before);
});
