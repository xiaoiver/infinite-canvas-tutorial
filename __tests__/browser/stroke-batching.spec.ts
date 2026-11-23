import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import { installProbes } from './fixtures/probes';
import { installVertexUploadProbe } from './fixtures/vertex-uploads';
import type {} from './fixtures/core-path-instances';
import type {} from './fixtures/polyline-lod';

type Backend = 'core' | 'ecs';
test.use({
  viewport: { width: 1000, height: 760 },
  contextOptions: { screen: { width: 1000, height: 760 } },
});
function compare(a: Buffer, b: Buffer) {
  const x = PNG.sync.read(a),
    y = PNG.sync.read(b);
  expect([x.width, x.height]).toEqual([y.width, y.height]);
  let ink = 0,
    difference = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] < 240 || x.data[i + 1] < 240 || x.data[i + 2] < 240) ink++;
    if ([0, 1, 2, 3].some((c) => Math.abs(x.data[i + c] - y.data[i + c]) > 3))
      difference++;
  }
  expect(ink).toBeGreaterThan(100);
  expect(difference).toBeLessThan(20);
}
async function scene(
  page: Page,
  backend: Backend,
  count = 300,
  overlap = false,
  barrier = false,
) {
  await page.evaluate(
    async ({ backend, count, overlap, barrier }) => {
      if (backend === 'core')
        return window.corePathInstances.strokes(count, overlap, barrier);
      await window.polylineLOD.zoom(0.75);
      const nodes: any[] = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          id: i === 0 ? 'line' : `n${i}`,
          type: 'path',
          width: 30,
          height: 30,
          batchable: true,
          zIndex: i * 2,
          d: `M0 15 C${5 + (i % 4)} -10 22 40 30 15`,
          x: overlap ? 100 + i * 3 : 20 + (i % 20) * 40,
          y: overlap ? 100 + i * 2 : 20 + Math.floor(i / 20) * 35,
          fills: [],
          strokes: [{ type: 'solid', value: '#2563eb' }],
          strokeWidth: 3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: 0.65,
        });
        if (i === 0 && barrier)
          nodes.push({
            id: 'barrier',
            type: 'rect',
            x: 105,
            y: 110,
            width: 35,
            height: 15,
            fills: [{ type: 'solid', value: '#facc15' }],
            opacity: 0.5,
            zIndex: 1,
          });
      }
      await window.polylineLOD.document(nodes);
      await window.polylineLOD.camera(0.001);
      window.polylineLOD.resetWork();
      await window.polylineLOD.camera(0);
    },
    { backend, count, overlap, barrier },
  );
}
async function enable(page: Page, backend: Backend, value: boolean) {
  await page.evaluate(
    async ({ backend, value }) => {
      if (backend === 'core') return window.corePathInstances.enable(value);
      await window.polylineLOD.pathInstancing(value);
      await window.polylineLOD.camera(0.001);
      window.polylineLOD.resetWork();
      await window.polylineLOD.camera(0);
    },
    { backend, value },
  );
}
async function state(page: Page, backend: Backend) {
  return page.evaluate(
    (b) =>
      b === 'core'
        ? window.corePathInstances.state()
        : window.polylineLOD.state(),
    backend,
  );
}
for (const backend of ['core', 'ecs'] as const) {
  test.describe(backend, () => {
    let errors: string[];
    test.beforeEach(async ({ page }) => {
      errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (/GL_INVALID|GL_OUT_OF_MEMORY|CONTEXT_LOST/.test(m.text()))
          errors.push(m.text());
      });
      await page.addInitScript(installProbes);
      await page.addInitScript(installVertexUploadProbe);
      await page.goto(
        backend === 'core' ? '/core-path-instances.html' : '/polyline-lod.html',
      );
      await expect(page.locator('#status')).toHaveText('Ready');
    });
    test.afterEach(async ({ page }) => {
      const baseline = await page.evaluate(
        async (b) =>
          b === 'core'
            ? window.corePathInstances.destroy()
            : window.polylineLOD.destroy(),
        backend,
      );
      if (backend === 'core')
        expect(
          await page.evaluate(() => window.lifecycleProbes.resources()),
        ).toEqual(baseline);
      else
        expect(
          await page.evaluate(() => window.lifecycleProbes.leaks()),
        ).toEqual([]);
      expect(errors).toEqual([]);
    });
    test('default off; 300 different curves retain pixels and segments in two ordered pages', async ({
      page,
    }) => {
      await scene(page, backend);
      const off = await state(page, backend),
        full = await page.locator('canvas').screenshot();
      expect(off.strokePages).toBe(0);
      expect(off.visible).toBe(300);
      expect(off.native.drawcalls).toBe(301);
      await enable(page, backend, true);
      const on = await state(page, backend);
      expect(on.strokePages).toBe(2);
      expect(on.visible).toBe(300);
      expect(on.document).toEqual(off.document);
      expect(on.native.indices).toBe(off.native.indices);
      expect(on.native.drawcalls).toBe(3);
      compare(await page.locator('canvas').screenshot(), full);
      await page.evaluate(async (b) => {
        if (b === 'core') window.corePathInstances.camera(0.25);
        else {
          window.polylineLOD.resetWork();
          window.vertexUploads.reset();
          await window.polylineLOD.camera(0.25);
        }
      }, backend);
      expect((await state(page, backend)).native.bufferUploads).toBe(1);
      expect(await page.evaluate(() => window.vertexUploads.calls)).toBe(0);
      await enable(page, backend, false);
      expect((await state(page, backend)).strokePages).toBe(0);
    });
    test('overlap, caps, joins, painter barriers and style edits retain full-path pixels', async ({
      page,
    }) => {
      for (const barrier of [false, true]) {
        await enable(page, backend, false);
        await scene(page, backend, 3, true, barrier);
        const full = await page.locator('canvas').screenshot();
        await enable(page, backend, true);
        expect((await state(page, backend)).strokePages).toBe(barrier ? 2 : 1);
        compare(await page.locator('canvas').screenshot(), full);
      }
      for (const edit of [
        { strokeLinecap: 'square', strokeLinejoin: 'bevel' },
        { d: 'M0 0L30 20L0 30', x: 130 },
        { strokeWidth: 7, opacity: 0.4 },
        { strokeDasharray: [4, 2] },
        { rotation: 0.4 },
      ]) {
        await page.evaluate(
          async ({ backend, edit }) => {
            if (backend === 'core') window.corePathInstances.mutate(0, edit);
            else
              await window.polylineLOD.patch(
                'strokeDasharray' in edit && Array.isArray(edit.strokeDasharray)
                  ? { ...edit, strokeDasharray: edit.strokeDasharray.join(' ') }
                  : edit,
              );
          },
          { backend, edit },
        );
        const on = await page.locator('canvas').screenshot();
        await enable(page, backend, false);
        compare(await page.locator('canvas').screenshot(), on);
        await enable(page, backend, true);
      }
    });
    test('picking, parent transforms, history and camera migration retain original paths', async ({
      page,
    }) => {
      await scene(page, backend, 3);
      await enable(page, backend, true);
      if (backend === 'core') {
        expect(
          await page.evaluate(() => window.corePathInstances.pick(33.875, 35)),
        ).toBe(0);
        for (const scale of [1, 1.4, 1]) {
          await page.evaluate(
            (scale) => window.corePathInstances.parent(20, scale),
            scale,
          );
          expect((await state(page, backend)).strokePages).toBe(
            scale === 1 ? 1 : 0,
          );
          const on = await page.locator('canvas').screenshot();
          await enable(page, backend, false);
          compare(await page.locator('canvas').screenshot(), on);
          await enable(page, backend, true);
        }
      } else {
        const picked = await page.evaluate(() =>
          window.polylineLOD.pathPoint(),
        );
        expect(picked.hits).toContain('line');
        const point = picked.viewport;
        await page.mouse.move(point.x, point.y);
        await expect
          .poll(() =>
            page.evaluate(() => window.polylineLOD.interaction().highlighted),
          )
          .toBe(true);
        await page.mouse.click(point.x, point.y);
        await expect
          .poll(() =>
            page.evaluate(() => window.polylineLOD.interaction().selected),
          )
          .toBe(true);
        await page.evaluate(() => window.polylineLOD.interact('select', false));
        await page.mouse.move(1, 1);
        await page.mouse.down();
        await page.mouse.move(70, 60, { steps: 8 });
        await page.mouse.up();
        await expect
          .poll(() =>
            page.evaluate(() => window.polylineLOD.interaction().selected),
          )
          .toBe(true);
        const pathX = () =>
          page.evaluate(
            () =>
              window.polylineLOD.state().document.find((n) => n.id === 'line')!
                .x,
          );
        const before = await pathX();
        await page.evaluate(() => window.polylineLOD.patch({ x: 100 }));
        await page.evaluate(() => window.polylineLOD.history('undo'));
        expect(await pathX()).toBe(before);
        await page.evaluate(() => window.polylineLOD.history('redo'));
        expect(await pathX()).toBe(100);
        await page.evaluate(() => window.polylineLOD.interact('select', false));
        for (const back of [false, true]) {
          const membership = await page.evaluate(
            (back) => window.polylineLOD.movePathCamera(back),
            back,
          );
          expect(membership.flat().filter((id) => id === 'line')).toHaveLength(
            1,
          );
        }
      }
    });
    test('WebGL1 uses at most eight attribute locations and preserves full-path pixels', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          type: string,
          ...args: unknown[]
        ) {
          return type === 'webgl2' ? null : get.call(this, type, ...args);
        } as typeof get;
      });
      await page.reload();
      await expect(page.locator('#status')).toHaveText('Ready');
      await scene(page, backend, 12);
      const full = await page.locator('canvas').screenshot();
      await enable(page, backend, true);
      expect((await state(page, backend)).strokePages).toBe(1);
      compare(await page.locator('canvas').screenshot(), full);
    });
    test('full raster exports remain identical; culling, reentry and same-frame removal retire pages', async ({
      page,
    }) => {
      await scene(page, backend, 3);
      await enable(page, backend, true);
      for (const partial of [false, true]) {
        const on = await page.evaluate(
          async ({ backend, partial }) =>
            backend === 'core'
              ? window.corePathInstances.export(partial)
              : window.polylineLOD.export(partial),
          { backend, partial },
        );
        await enable(page, backend, false);
        const off = await page.evaluate(
          async ({ backend, partial }) =>
            backend === 'core'
              ? window.corePathInstances.export(partial)
              : window.polylineLOD.export(partial),
          { backend, partial },
        );
        expect(on).toBe(off);
        await enable(page, backend, true);
      }
      await page.evaluate(async (b) => {
        if (b === 'core') window.corePathInstances.camera(10000);
        else await window.polylineLOD.camera(10000);
      }, backend);
      expect((await state(page, backend)).strokePages).toBe(0);
      await page.evaluate(
        async (b) =>
          b === 'core'
            ? window.corePathInstances.camera(0)
            : window.polylineLOD.camera(0),
        backend,
      );
      expect((await state(page, backend)).strokePages).toBe(1);
      await page.evaluate(async (b) => {
        if (b === 'core') window.corePathInstances.remove(0);
        else await window.polylineLOD.removeDuringZoom();
      }, backend);
      expect((await state(page, backend)).visible).toBe(2);
    });
  });
}
