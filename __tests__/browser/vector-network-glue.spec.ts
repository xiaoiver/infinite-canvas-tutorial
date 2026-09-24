import { expect, test, type Page } from '@playwright/test';
import type { VectorNetworkSerializedNode } from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';
declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
const network = (): VectorNetworkSerializedNode => ({
  id: 'glue',
  type: 'vector-network',
  version: 1,
  zIndex: 1,
  x: 40,
  y: 30,
  width: 180,
  height: 180,
  vertices: [
    { x: 90, y: 90 },
    { x: 0, y: 0 },
    { x: 180, y: 0 },
    { x: 90, y: 180 },
  ],
  segments: [
    { start: 0, end: 1 },
    { start: 0, end: 2 },
    { start: 3, end: 0 },
  ],
  regions: [],
  strokes: [{ type: 'solid', value: '#000' }],
  fills: [],
  strokeWidth: 2,
});
const node = (page: Page) =>
  page.evaluate(
    () =>
      window.canvasRegression.state('left')!
        .nodes[0] as VectorNetworkSerializedNode,
  );
const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const geometry = async (page: Page) => {
  const n = await node(page);
  return [n.x, n.y, n.vertices, n.segments, n.regions];
};
async function point(page: Page, index: number) {
  const n = await node(page),
    v = n.vertices[index];
  const p = await page.evaluate(
    ([x, y]) => window.canvasRegression.viewportPoint('left', 'glue', [x, y]),
    [v.x, v.y],
  );
  const b = (await page.locator('#left canvas').boundingBox())!;
  return { x: b.x + p.x, y: b.y + p.y };
}
async function select(page: Page, index: number) {
  const p = await point(page, index);
  await page.mouse.move(p.x, p.y);
  await frame(page);
  await page.mouse.click(p.x, p.y, { delay: 50 });
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
const controls = (page: Page) =>
  page.locator('ic-spectrum-vector-topology-controls:not([faces])');
async function open(page: Page) {
  await controls(page)
    .getByRole('button', { name: 'Glue / Unglue', exact: true })
    .click();
  await expect(page.locator('[data-vector-topology-preview]')).toBeVisible();
}
async function unglue(page: Page) {
  await open(page);
  await controls(page)
    .getByRole('checkbox', { name: 'E1 · Start', exact: true })
    .click();
  await controls(page)
    .getByRole('button', { name: 'Unglue', exact: true })
    .click();
  await expect.poll(() => node(page).then((n) => n.vertices.length)).toBe(5);
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
    network(),
  );
  await frame(page);
  const b = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.dblclick(b.x + 85, b.y + 75, { delay: 60 });
  await expect.poll(() => node(page).then((n) => n.isEditing)).toBe(true);
  await page.evaluate(() =>
    window.canvasRegression.vectorToolbar('left', 'glue'),
  );
  await select(page, 0);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('unglues chosen edges, glues back explicitly, and records each as one undo step', async ({
  page,
}) => {
  const before = await geometry(page);
  await unglue(page);
  const split = await geometry(page);
  expect((await node(page)).segments.map((e) => [e.start, e.end])).toEqual([
    [4, 1],
    [0, 2],
    [3, 0],
  ]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.canvasRegression.state('left')!.state
            .vectorNetworkSelectedVertex?.index,
      ),
    )
    .toBe(4);
  await open(page);
  await controls(page)
    .getByRole('button', { name: 'Target vertex', exact: true })
    .click();
  await page.getByRole('option', { name: 'V1', exact: true }).click();
  await controls(page)
    .getByRole('button', { name: 'Glue', exact: true })
    .click();
  await expect.poll(() => node(page).then((n) => n.vertices.length)).toBe(4);
  const glued = await geometry(page);
  expect((await node(page)).segments).toEqual(network().segments);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(() => geometry(page)).toEqual(split);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect.poll(() => geometry(page)).toEqual(before);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect.poll(() => geometry(page)).toEqual(split);
  await page.evaluate(() => window.canvasRegression.redo('left'));
  await expect.poll(() => geometry(page)).toEqual(glued);
});

for (const transformed of [false, true])
  test(`drags the detached copy without moving the original (transformed=${transformed})`, async ({
    page,
  }) => {
    if (transformed) {
      await page.evaluate(() =>
        window.canvasRegression.update('left', 'glue', {
          x: 280,
          y: 50,
          rotation: 0.55,
          scaleX: -0.8,
          scaleY: 1.3,
        }),
      );
      await frame(page);
      await select(page, 0);
    }
    await unglue(page);
    const original = await point(page, 0),
      copy = await point(page, 4);
    await page.mouse.move(copy.x, copy.y);
    await frame(page);
    await page.mouse.down();
    await frame(page);
    await page.mouse.move(copy.x + 45, copy.y + 25, { steps: 8 });
    await frame(page);
    await page.mouse.up();
    await frame(page);
    const moved = await point(page, 4),
      stayed = await point(page, 0);
    expect(
      Math.hypot(stayed.x - original.x, stayed.y - original.y),
    ).toBeLessThan(0.05);
    expect(
      Math.hypot(moved.x - copy.x - 45, moved.y - copy.y - 25),
    ).toBeLessThan(0.05);
  });

test('preview and cancellation do not mutate geometry; empty and whole-vertex unglue are disabled', async ({
  page,
}) => {
  const before = await geometry(page);
  await open(page);
  await controls(page).evaluate((el) =>
    el
      .shadowRoot!.querySelector('sp-overlay')!
      .dispatchEvent(new CustomEvent('sp-opened')),
  );
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(1);
  const unglueButton = controls(page).getByRole('button', {
    name: 'Unglue',
    exact: true,
  });
  await expect(unglueButton).toBeDisabled();
  for (const label of ['E1 · Start', 'E2 · Start', 'E3 · End'])
    await controls(page)
      .getByRole('checkbox', { name: label, exact: true })
      .click();
  await expect(unglueButton).toBeDisabled();
  expect(await geometry(page)).toEqual(before);
  await controls(page)
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  expect(await geometry(page)).toEqual(before);
});

test('invalidates an open operation after external geometry changes and history navigation', async ({
  page,
}) => {
  await open(page);
  const n = await node(page);
  const vertices = n.vertices.map((v, i) =>
    i === 1 ? { ...v, x: v.x + 10 } : v,
  );
  await page.evaluate(
    (vertices) => window.canvasRegression.update('left', 'glue', { vertices }),
    vertices,
  );
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  expect((await node(page)).vertices).toEqual(vertices);
  await select(page, 0);
  await open(page);
  await page.evaluate(() => window.canvasRegression.undo('left'));
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
});

test('reopens within a narrow viewport after changing the desktop placement', async ({
  page,
}) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-vector-topology-preview]')).toHaveCount(0);
  await open(page);
  await expect
    .poll(async () => {
      const box = await controls(page)
        .locator('sp-popover')
        .first()
        .boundingBox();
      return !!box && box.x >= 0 && box.x + box.width <= 390;
    })
    .toBe(true);
});
