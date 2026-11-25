import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type { BrowserHarness } from './fixtures/main';
declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
import type {} from './fixtures/gizmo';

const shapes = (prefix: string) =>
  Array.from({ length: 24 }, (_, i) => ({
    id: `${prefix}-${i}`,
    type: 'rect' as const,
    name: `${prefix} name ${i}`,
    zIndex: i,
    x: 35 + (i % 6) * 40,
    y: 40 + Math.floor(i / 6) * 35,
    width: 24,
    height: 20,
    fills: [{ type: 'solid' as const, value: '#237dbe' }],
  }));
const visible = (side: string) => `#${side} div[style*="visibility: visible"]`;

test('disabled labels skip Name reads, restore selections and isolate canvases', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes, { resourceStacks: false });
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(
    async ({ left, right }) => {
      const h = window.canvasRegression;
      await h.setScene('left', left, 'left-0');
      await h.setScene('right', right, 'right-0');
      await h.settleFrames();
    },
    { left: shapes('left'), right: shapes('right') },
  );
  const documents = await page.evaluate(() => ({
    left: window.canvasRegression.state('left')!.nodes,
    right: window.canvasRegression.state('right')!.nodes,
  }));
  let work = await page.evaluate(() =>
    window.canvasRegression.sampleNameLabels(),
  );
  expect(work.executions).toBeGreaterThan(0);
  expect(work.reads).toBe(0);
  const left = page
    .locator(visible('left'))
    .filter({ hasText: /^left name 0$/ });
  const right = page
    .locator(visible('right'))
    .filter({ hasText: /^right name 0$/ });
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', {
      penbarNameLabelVisible: true,
    }),
  );
  await expect(left).toHaveCount(1);
  work = await page.evaluate(() => window.canvasRegression.sampleNameLabels());
  expect(work.reads).toBeGreaterThan(0); // Positive control for the observer.
  await expect(right).toHaveCount(0);
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('right', {
      penbarNameLabelVisible: true,
    }),
  );
  await expect(right).toHaveCount(1);
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', {
      penbarNameLabelVisible: false,
    }),
  );
  await expect(left).toHaveCount(0);
  await expect(right).toHaveCount(1);
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('right', {
      penbarNameLabelVisible: false,
    }),
  );
  work = await page.evaluate(() => window.canvasRegression.sampleNameLabels());
  expect(work.executions).toBeGreaterThan(0);
  expect(work.reads).toBe(0);
  await expect(right).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      left: window.canvasRegression.state('left')!.nodes,
      right: window.canvasRegression.state('right')!.nodes,
    })),
  ).toEqual(documents);
  // Remove a previously labeled entity while the fast path is active.
  await page.evaluate(async () => {
    const h = window.canvasRegression;
    await h.setScene('left', [], []);
    await h.setPreferences('left', { penbarNameLabelVisible: true });
    await h.settleFrames();
  });
  await expect(
    page.locator('#left div').filter({ hasText: /^left name 0$/ }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('right', {
      penbarNameLabelVisible: true,
    }),
  );
  await expect(right).toHaveCount(1);
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
  expect(errors).toEqual([]);
});

test('re-enabled labels follow hover, camera, hidden shapes and renamed selections', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async (nodes) => {
    const h = window.canvasRegression;
    await h.setScene('left', nodes, []);
    await h.setPreferences('left', { penbarNameLabelVisible: true });
  }, shapes('hover'));
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + 45, box.y + 50);
  await page.evaluate(() => window.canvasRegression.settleFrames());
  const label = page
    .locator(visible('left'))
    .filter({ hasText: /^hover name 0$/ });
  await expect(label).toHaveCount(1);
  await page.evaluate(async () => {
    const h = window.canvasRegression;
    await h.setPreferences('left', { penbarNameLabelVisible: false });
    await h.selectNodes('left', ['hover-0']);
    await h.update('left', 'hover-0', { name: 'Renamed label' });
    await h.setZoom('left', 1.2);
    await h.setPreferences('left', { penbarNameLabelVisible: true });
  });
  await expect(label).toHaveCount(0);
  const renamed = page
    .locator(visible('left'))
    .filter({ hasText: /^Renamed label$/ });
  await expect(renamed).toHaveCount(1);
  const anchor = await page.evaluate(() =>
    window.canvasRegression.viewportPoint('left', 'hover-0', [0, 0]),
  );
  const position = await renamed.evaluate((el) => ({
    x: parseFloat((el as HTMLElement).style.left),
    y: parseFloat((el as HTMLElement).style.top),
  }));
  expect(position.x).toBeCloseTo(anchor.x, 3);
  expect(position.y + 24).toBeCloseTo(anchor.y, 3);
  await page.evaluate(() =>
    window.canvasRegression.update('left', 'hover-0', { visibility: 'hidden' }),
  );
  await expect(renamed).toHaveCount(0);
  await page.evaluate(() =>
    window.canvasRegression.update('left', 'hover-0', {
      visibility: 'visible',
    }),
  );
  await expect(renamed).toHaveCount(1);
  await page.evaluate(() => window.canvasRegression.shutdown());
});

test('projected companion labels hide and recover when toggled in a free 3D view', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gizmo.html?appCamera&nameLabels');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => {
      editor.updateNode(editor.getNodeById('model'), {
        name: 'Projected model',
      });
      editor.setAppState({ penbarNameLabelVisible: true });
      editor.setCamera3D({
        preset: 'isometric',
        center: [80, 80, 0],
        distance: 500,
        orthographicHeight: 200,
      });
    });
    await window.gizmoTest.settle();
  });
  const label = page
    .locator('div[style*="visibility: visible"]')
    .filter({ hasText: /^Projected model$/ });
  await expect(label).toHaveCount(1);
  await page.evaluate(async () => {
    await window.gizmoTest
      .api()
      .edit((e) => e.setAppState({ penbarNameLabelVisible: false }));
    await window.gizmoTest.settle();
  });
  await expect(label).toHaveCount(0);
  await page.evaluate(async () => {
    await window.gizmoTest
      .api()
      .edit((e) => e.setAppState({ penbarNameLabelVisible: true }));
    await window.gizmoTest.settle();
  });
  await expect(label).toHaveCount(1);
  expect(errors).toEqual([]);
});
