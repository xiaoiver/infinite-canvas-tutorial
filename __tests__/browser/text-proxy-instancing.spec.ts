import { test, expect } from '@playwright/test';
import { installProbes } from './fixtures/probes';
import { installVertexUploadProbe } from './fixtures/vertex-uploads';
import type { TextLODHarness } from './fixtures/text-lod';
declare global {
  interface Window {
    textLOD: TextLODHarness;
  }
}
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(installVertexUploadProbe);
  await page.goto('/text-lod.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.textLOD.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
  expect(errors).toEqual([]);
});
test('line instancing preserves proxy pixels for colors, opacity, affine transforms and painter-order barriers', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD;
    await h.zoom(0.25);
    await h.enable(true);
    const labels = [
      {
        id: 'text',
        type: 'text',
        x: 80,
        y: 60,
        width: 180,
        height: 50,
        fontSize: 18,
        content: 'First long line\n\nThird line',
        rotation: 0.2,
        scaleX: -0.9,
        scaleY: 0.8,
        zIndex: 0,
        opacity: 0.6,
        fills: [{ type: 'solid', value: '#d03020', opacity: 0.7 }],
      },
      {
        id: 'text-1',
        type: 'text',
        x: 40,
        y: 65,
        width: 180,
        height: 50,
        fontSize: 18,
        content: 'Overlap blue\nSecond line',
        rotation: -0.1,
        zIndex: 1,
        opacity: 0.7,
        fills: [{ type: 'solid', value: '#2050d0', opacity: 0.6 }],
      },
      {
        id: 'text-2',
        type: 'text',
        x: 110,
        y: 80,
        width: 180,
        height: 50,
        fontSize: 16,
        content: 'Green',
        rotation: 0.3,
        zIndex: 2,
        fills: [{ type: 'solid', value: '#208040' }],
      },
    ];
    const sample = async (barrier: boolean, batchable: boolean) => {
      const nodes: any[] = labels.map((n) => ({ ...n, batchable }));
      if (barrier)
        nodes.splice(1, 0, {
          id: 'barrier',
          type: 'rect',
          x: 40,
          y: 65,
          width: 160,
          height: 50,
          zIndex: 0.5,
          opacity: 0.5,
          fills: [{ type: 'solid', value: '#e0c020' }],
        });
      await h.document(nodes);
      return { pixels: h.screen(), state: h.state() };
    };
    return {
      independent: await sample(false, false),
      batched: await sample(false, true),
      barrierIndependent: await sample(true, false),
      barrierBatched: await sample(true, true),
    };
  });
  expect(result.batched.pixels).toBe(result.independent.pixels);
  expect(result.batched.state.drawcalls).toBe(1);
  expect(result.batched.state.vertices).toBe(result.independent.state.vertices);
  expect(result.barrierBatched.pixels).toBe(result.barrierIndependent.pixels);
  expect(result.barrierBatched.state.ctors).toEqual([
    'TextProxy',
    'SDF',
    'TextProxy',
  ]);
});

test('batched text migrates immediately for interactions, visibility, viewport reentry and deletion without accumulating resources', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD;
    await h.zoom(0.024);
    await h.enable(true);
    await h.seed(1000, true);
    const initial = h.state();
    await h.patch({ content: 'Changed first line\n\nSecond\nThird' });
    const changedLines = h.state();
    await h.patch({
      content: initial.nodes[0].type === 'text' ? initial.nodes[0].content : '',
    });
    await h.select(true);
    const selected = h.state();
    await h.select(false);
    await h.hover(true);
    const hovered = h.state();
    await h.hover(false);
    await h.patch({ isEditing: true });
    const editing = h.state();
    await h.patch({ isEditing: false });
    await h.patch({ visibility: 'hidden' });
    const hidden = h.state();
    await h.patch({ visibility: 'visible' });
    await h.patch({ batchable: false });
    const privateText = h.state();
    await h.patch({ batchable: true });
    await h.camera(1e6);
    const outside = h.state();
    await h.camera(0);
    const reentered = h.state();
    const resources = window.lifecycleProbes.resources();
    for (let i = 0; i < 6; i++) {
      await h.select(true);
      await h.select(false);
      await h.camera(1e6);
      await h.camera(0);
    }
    const after = h.state();
    const endResources = window.lifecycleProbes.resources();
    const remaining = await h.deleteAllDuringZoom();
    return {
      initial,
      changedLines,
      selected,
      hovered,
      editing,
      hidden,
      privateText,
      outside,
      reentered,
      after,
      resources,
      endResources,
      remaining,
    };
  });
  expect(result.initial.drawcalls).toBe(1);
  expect(result.initial.vertices).toBe(8000);
  expect(result.changedLines.drawcalls).toBe(1);
  expect(result.changedLines.vertices).toBe(8004);
  for (const key of ['selected', 'hovered', 'editing'] as const) {
    expect(result[key].level).toBe('full');
    expect(result[key].ctors).toContain('SDFText');
  }
  expect(result.hidden.nodes).toHaveLength(1000);
  expect(result.privateText.drawcalls).toBe(2);
  expect(result.outside.drawcalls).toBe(0);
  expect(result.reentered.drawcalls).toBe(1);
  expect(result.after.nodes).toEqual(result.initial.nodes);
  expect(result.endResources).toEqual(result.resources);
  expect(result.remaining).toBe(0);
});

test('batched proxy screen pages never replace full-precision export geometry', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD;
    await h.seed(3, true);
    await h.zoom(0.3);
    const full = await h.export(false),
      partial = await h.export(true);
    await h.enable(true);
    const fullBatched = await h.export(false),
      partialBatched = await h.export(true);
    await h.zoom(0.3);
    return { full, partial, fullBatched, partialBatched, state: h.state() };
  });
  expect(result.fullBatched).toBe(result.full);
  expect(result.partialBatched).toBe(result.partial);
  expect(result.state.drawcalls).toBe(1);
});

test('camera-only frames upload no line data and one material edit touches only that text row range', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const h = window.textLOD,
      uploads = window.vertexUploads;
    await h.zoom(0.024);
    await h.enable(true);
    await h.seed(1000, true);
    uploads.reset();
    await h.zoom(0.0241);
    const camera = {
      calls: uploads.calls,
      bytes: uploads.bytes,
      allocations: uploads.allocations,
    };
    uploads.reset();
    await h.patch({ fills: [{ type: 'solid', value: 'red' }] });
    return {
      camera,
      edit: {
        calls: uploads.calls,
        bytes: uploads.bytes,
        allocations: uploads.allocations,
      },
    };
  });
  expect(result.camera).toEqual({ calls: 0, bytes: 0, allocations: 0 });
  expect(result.edit).toEqual({ calls: 1, bytes: 128, allocations: 0 });
});
