import { expect, test, type Page } from '@playwright/test';
import { makeGraph, percentile, visibleNodes, zoomAt } from './graph';

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.workflowDemo?.snapshot().ready);
  await expect
    .poll(() => page.evaluate(() => window.workflowDemo.snapshot().frames))
    .toBeGreaterThan(8);
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.workflowDemo.snapshot());

test('graph topology and anchored zoom remain correct at stress scale', () => {
  const graph = makeGraph(2400);
  const ids = new Set(graph.nodes.map((n) => n.id));
  expect(ids.size).toBe(2400);
  expect(graph.edges).toHaveLength(2400);
  expect(graph.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
  const before = { x: -20, y: 40, zoom: 0.5 };
  const after = zoomAt(before, 1.2, 500, 300);
  expect(after.x + 500 / after.zoom).toBeCloseTo(before.x + 500 / before.zoom);
  expect(after.y + 300 / after.zoom).toBeCloseTo(before.y + 300 / before.zoom);
  expect(visibleNodes(graph.nodes, before, 1000, 700).length).toBeLessThan(
    2400,
  );
  expect(percentile([8, 2, 17, 5, 10], 0.95)).toBe(17);
});

test('renders WebGL nodes, moves a selected card, persists settings and exports the graph', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const initial = await snapshot(page);
  expect(initial.renderedNodes).toBe(24);
  expect(initial.renderedEdges).toBe(24);
  const bounds = (await page.locator('#canvas').boundingBox())!;
  const node = initial.positions[0];
  const x = bounds.x + (node.x - initial.view.x + 80) * initial.view.zoom;
  const y = bounds.y + (node.y - initial.view.y + 70) * initial.view.zoom;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#selected-title')).toHaveText(
    'Creative direction',
  );
  await expect
    .poll(async () => (await snapshot(page)).positions[0].x)
    .toBeCloseTo(node.x + 70 / initial.view.zoom, 0);
  await page.locator('#prompt').fill('A new cinematic camera direction.');
  await page.locator('#apply').click();
  await page.locator('#run').click();
  await expect(page.locator('#run')).toBeEnabled();
  await page.keyboard.press('f');
  const download = page.waitForEvent('download');
  await page.locator('#export').click();
  expect((await download).suggestedFilename()).toBe('frame-workflow.json');
  expect(errors).toEqual([]);
});

test('zooms around the pointer, pans, and cancels a performance tour on navigation', async ({
  page,
}) => {
  await ready(page);
  const initial = await snapshot(page);
  const bounds = (await page.locator('#canvas').boundingBox())!;
  const anchor = { x: bounds.width / 2, y: 210 };
  await page.mouse.move(bounds.x + anchor.x, bounds.y + anchor.y);
  await page.mouse.wheel(0, -90);
  await expect
    .poll(async () => (await snapshot(page)).view.zoom)
    .toBeGreaterThan(initial.view.zoom);
  const zoomed = await snapshot(page);
  expect(zoomed.view.x + anchor.x / zoomed.view.zoom).toBeCloseTo(
    initial.view.x + anchor.x / initial.view.zoom,
    3,
  );
  await page.locator('[data-tool="hand"]').click();
  await page.mouse.move(bounds.x + 400, bounds.y + 300);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 500, bounds.y + 340, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => (await snapshot(page)).view.x)
    .toBeLessThan(zoomed.view.x);
  await page.locator('#benchmark').click();
  await expect(page.locator('#benchmark')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.mouse.move(bounds.x + 400, bounds.y + 300);
  await page.mouse.wheel(0, 30);
  await expect(page.locator('#benchmark')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('switches through all scene scales, completes a real tour, and reuses a reduced scene', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  for (const count of [120, 600, 2400, 24]) {
    await page.locator('#scale').selectOption(String(count));
    await page.waitForFunction((expected) => {
      const state = window.workflowDemo.snapshot();
      return (
        state.ready &&
        state.nodes === expected &&
        state.renderedNodes === expected
      );
    }, count);
    expect((await snapshot(page)).renderedEdges).toBe(count);
    if (count === 2400) {
      await page.locator('#overview').click();
      const frames = (await snapshot(page)).frames;
      await expect
        .poll(async () => (await snapshot(page)).frames, { timeout: 90000 })
        .toBeGreaterThan(frames + 2);
      await expect(page.locator('#visible-count')).toHaveText('2,400');
    }
  }
  await page.locator('#scale').selectOption('120');
  await page.waitForFunction(
    () =>
      window.workflowDemo.snapshot().ready &&
      window.workflowDemo.snapshot().nodes === 120,
  );
  await page.locator('#benchmark').click();
  await expect(page.locator('#benchmark-result')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('#benchmark-result')).toContainText('120 节点');
  await expect(page.locator('#benchmark-result')).toContainText('本机实测');
  const report = await page.locator('#benchmark-result').textContent();
  test
    .info()
    .annotations.push({ type: 'measured-performance', description: report! });
  expect(Number(report!.match(/([\d.]+) FPS/)![1])).toBeGreaterThan(0);
  await page.locator('#scale').selectOption('24');
  await page.waitForFunction(
    () =>
      window.workflowDemo.snapshot().ready &&
      window.workflowDemo.snapshot().nodes === 24,
  );
  await page.locator('#add').click();
  await page.waitForFunction(
    () =>
      window.workflowDemo.snapshot().ready &&
      window.workflowDemo.snapshot().nodes === 30,
  );
  expect((await snapshot(page)).renderedNodes).toBe(30);
  expect(errors).toEqual([]);
});

test('supports a narrow viewport and respects reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 740, height: 860 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await expect(page.locator('.inspector')).toBeHidden();
  await expect(page.locator('#canvas')).toBeVisible();
  await page.locator('#benchmark').click();
  await expect(page.locator('#toast')).toContainText('减少动态效果');
  await page.locator('#help').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).not.toBeVisible();
});
