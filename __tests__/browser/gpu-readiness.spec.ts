/// <reference types="vite/client" />
import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/gpu-readiness';
import type {} from '../../examples/workflow-canvas/main';

function failContexts(all: boolean) {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args: any[]) {
    if (
      ['webgl', 'webgl2', 'experimental-webgl'].includes(args[0]) &&
      (all || this.id === 'failed')
    )
      return null;
    return (get as any).apply(this, args);
  } as typeof get;
  if (all && typeof OffscreenCanvas !== 'undefined') {
    const offscreen = OffscreenCanvas.prototype.getContext;
    OffscreenCanvas.prototype.getContext = function (...args: any[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(args[0]))
        return null;
      return (offscreen as any).apply(this, args);
    } as typeof offscreen;
  }
}
for (const { backend, cancel } of [
  { backend: 'core', cancel: false },
  { backend: 'core', cancel: true },
  { backend: 'ecs', cancel: false },
])
  test(`${backend}${
    cancel ? ' cancelled immediately' : ''
  }: context rejection leaves a healthy peer usable and cleans failed initialization`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes);
    await page.addInitScript(failContexts, false);
    await page.goto(
      '/gpu-readiness.html?backend=' + backend + (cancel ? '&cancel=1' : ''),
    );
    // Screenshot assertions install Playwright's main-world interceptors once.
    // Install them while startup is gated, before capturing the page baseline.
    await page.locator('#start').screenshot();
    await page.getByRole('button', { name: 'Start fixture' }).click();
    await expect(page.locator('#status')).toHaveText('Done');
    const state = await page.evaluate(() => ({
      outcomes: window.gpuReadiness.outcomes,
      attached: window.gpuReadiness.attached,
    }));
    expect(state.outcomes[0].status).toBe('rejected');
    expect(state.outcomes[0].error).toMatch(/GPU|WebGL|context/i);
    expect(state.outcomes[1].status).toBe('fulfilled');
    if (backend === 'ecs') expect(state.attached).toEqual([false, true]);
    const pixels = PNG.sync.read(await page.locator('#healthy').screenshot());
    let blue = 0;
    for (let i = 0; i < pixels.data.length; i += 4)
      if (pixels.data[i + 2] > 150 && pixels.data[i] < 80) blue++;
    expect(blue).toBeGreaterThan(1000);
    const after = await page.evaluate(() => window.gpuReadiness.destroy());
    if (backend === 'core')
      expect(after.resources).toEqual(after.deviceBaseline);
    else expect(after.leaks).toEqual([]);
    expect(after.listeners).toBe(after.baseline);
    expect(errors).toEqual([]);
  });
test('ECS: shared offscreen rejection settles every affected canvas without unhandled errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(failContexts, true);
  await page.goto('/gpu-readiness.html?backend=ecs');
  await page.getByRole('button', { name: 'Start fixture' }).click();
  await expect(page.locator('#status')).toHaveText('Done');
  expect(
    await page.evaluate(() =>
      window.gpuReadiness.outcomes.map((o) => o.status),
    ),
  ).toEqual(['rejected', 'rejected']);
  expect(await page.evaluate(() => window.gpuReadiness.attached)).toEqual([
    false,
    false,
  ]);
  const after = await page.evaluate(() => window.gpuReadiness.destroy());
  expect(after.leaks).toEqual([]);
  expect(after.listeners).toBe(after.baseline);
  expect(errors).toEqual([]);
});
test('Workflow: GPU failure keeps startup failed, metrics absent and releases the engine loop and texture URLs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(failContexts, true);
  await page.addInitScript(() => {
    const created: string[] = [],
      revoked: string[] = [],
      pending = new Set<number>();
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL),
      raf = requestAnimationFrame.bind(window),
      cancel = cancelAnimationFrame.bind(window);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
      return revoke(url);
    };
    window.requestAnimationFrame = (fn) => {
      const id = raf((t) => {
        pending.delete(id);
        fn(t);
      });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      pending.delete(id);
      return cancel(id);
    };
    Object.assign(window, {
      startupOwnership: () => ({ created, revoked, pending: pending.size }),
    });
  });
  await page.goto('/workflow-startup.html');
  await expect(page.locator('#loading.failed')).toBeVisible();
  await expect(page.locator('#loading')).toContainText('WebGL');
  await expect(page.locator('#node-status')).toHaveText('ERROR');
  await expect(page.locator('#metrics-state')).toHaveText('渲染不可用');
  await expect(page.locator('#fps')).toHaveText('—');
  await expect(page.locator('#frame-time')).toHaveText('—');
  await expect(page.locator('#scale')).toBeDisabled();
  await expect(page.locator('#benchmark')).toBeDisabled();
  await expect(page.locator('#zoom-in')).toBeDisabled();
  expect(
    await page.evaluate(() => window.workflowDemo.snapshot()),
  ).toMatchObject({
    ready: false,
    frames: 0,
    renderedNodes: 0,
    renderedEdges: 0,
  });
  const ownership = await page.evaluate(() =>
    (window as any).startupOwnership(),
  );
  expect(ownership.created.length).toBeGreaterThan(0);
  expect(ownership.revoked.sort()).toEqual(ownership.created.sort());
  expect(ownership.pending).toBe(0);
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
  expect(errors).toEqual([]);
});

test('ECS: unavailable WebGPU adapter rejects readiness and releases the World cleanly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => null },
    }),
  );
  await page.goto('/gpu-readiness.html?backend=ecs&renderer=webgpu');
  await page.getByRole('button', { name: 'Start fixture' }).click();
  await expect(page.locator('#status')).toHaveText('Done');
  expect(
    await page.evaluate(() =>
      window.gpuReadiness.outcomes.map((o) => o.status),
    ),
  ).toEqual(['rejected', 'rejected']);
  const after = await page.evaluate(() => window.gpuReadiness.destroy());
  expect(after.leaks).toEqual([]);
  expect(after.listeners).toBe(after.baseline);
  expect(errors).toEqual([]);
});

test('Workflow: healthy GPU startup enables interaction and real pixels, then cancels readiness on pagehide', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.goto('/workflow-startup.html');
  await expect(page.locator('#loading')).toBeHidden();
  expect(
    await page.evaluate(() => window.workflowDemo.snapshot()),
  ).toMatchObject({ ready: true, renderedNodes: 24, renderedEdges: 24 });
  await expect(page.locator('#node-status')).toHaveText('READY');
  const before = await page.locator('#zoom').textContent();
  await page.locator('#zoom-in').click();
  await expect(page.locator('#zoom')).not.toHaveText(before!);
  const context = await page
    .locator('#canvas')
    .evaluate((c: HTMLCanvasElement) => {
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return Boolean(gl && !gl.isContextLost());
    });
  expect(context).toBe(true);
  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let colored = 0;
  for (let y = 220; y < pixels.height - 220; y++)
    for (let x = 100; x < pixels.width - 100; x++) {
      const i = (y * pixels.width + x) * 4;
      const rgb = [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
      if (Math.max(...rgb) > 80 && Math.max(...rgb) - Math.min(...rgb) > 30)
        colored++;
    }
  expect(colored).toBeGreaterThan(500);
  await expect(page.locator('#fps')).not.toHaveText('—');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect
    .poll(() => page.evaluate(() => window.lifecycleProbes.leaks()))
    .toEqual([]);
  expect(await page.evaluate(() => window.workflowDemo.snapshot().ready)).toBe(
    false,
  );
  expect(errors).toEqual([]);
});
