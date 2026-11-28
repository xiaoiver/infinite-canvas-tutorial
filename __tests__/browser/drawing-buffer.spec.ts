import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import { readDrawingBufferContext } from './fixtures/drawing-buffer';
import { replayStrokeNodes } from './fixtures/camera-replay';
import type {} from './fixtures/core-path-instances';
import type { PolylineLODHarness } from './fixtures/polyline-lod';
declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}
test.use({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
test.setTimeout(60000);
for (const backend of ['core', 'ecs'] as const)
  for (const api of ['webgl2', 'webgl1'] as const)
    test(`${backend} ${api}: context defaults and both policies preserve idle/export pixels and ownership`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(installProbes, { resourceStacks: false });
      if (api === 'webgl1')
        await page.addInitScript(() => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (...args) {
            if (args[0] === 'webgl2') return null;
            return get.apply(this, args);
          } as typeof get;
        });
      const images: Record<string, string> = {};
      const partialImages: Record<string, string> = {};
      const presented: Record<string, Buffer> = {};
      for (const requested of [undefined, false, true]) {
        await page.goto(
          (backend === 'core'
            ? '/core-path-instances.html'
            : '/polyline-lod.html') +
            (requested === undefined
              ? ''
              : '?preserveDrawingBuffer=' + Number(requested)),
        );
        await expect(page.locator('#status')).toHaveText('Ready');
        const context = await page
          .locator('canvas')
          .evaluate(readDrawingBufferContext);
        expect(context.api).toBe(api === 'webgl1' ? 'webgl' : 'webgl2');
        expect(context.attributes!.preserveDrawingBuffer).toBe(
          requested ?? backend === 'ecs',
        );
        if (requested !== undefined) {
          expect(context.overrideRestored).toBe(true);
          expect(context.overrideAttempts).toBeGreaterThan(0);
        } else expect(context.overrideRestored).toBeUndefined();
        if (backend === 'ecs')
          expect(
            await page.evaluate(() =>
              window.polylineLOD.offscreenDrawingBufferPolicy(),
            ),
          ).toBe(true);
        await page.evaluate(
          async ({ backend, nodes }) => {
            if (backend === 'core') {
              window.corePathInstances.strokes(nodes.length);
              window.corePathInstances.enable(true);
              window.corePathInstances.replayCamera({ x: 0, y: 0, zoom: 0.5 });
            } else {
              await window.polylineLOD.document(nodes);
              await window.polylineLOD.pathInstancing(true);
              await window.polylineLOD.replayCamera({ x: 0, y: 0, zoom: 0.5 });
            }
          },
          { backend, nodes: replayStrokeNodes(24) },
        );
        const documentBefore = await page.evaluate(
          (b) =>
            b === 'core'
              ? window.corePathInstances.replayDocument()
              : window.polylineLOD.replayDocument(),
          backend,
        );
        const capture = () =>
          page.evaluate(
            (b) =>
              b === 'core'
                ? window.corePathInstances.export(false)
                : window.polylineLOD.export(false),
            backend,
          );
        const first = await capture();
        expect(first).toMatch(/^data:image\/png;base64,/);
        const pixels = await page.evaluate(async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          const c = document.createElement('canvas');
          c.width = image.width;
          c.height = image.height;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          let colored = 0;
          for (let i = 0; i < data.length; i += 4)
            if (
              data[i + 3] &&
              Math.max(data[i], data[i + 1], data[i + 2]) -
                Math.min(data[i], data[i + 1], data[i + 2]) >
                30
            )
              colored++;
          return { colored, width: c.width, height: c.height };
        }, first);
        expect(pixels.colored).toBeGreaterThan(100);
        expect(pixels.width).toBeGreaterThan(0);
        expect(pixels.height).toBeGreaterThan(0);
        if (backend === 'ecs') {
          const partial = await page.evaluate(() =>
            window.polylineLOD.export(true, 'replay-0'),
          );
          expect(partial).toMatch(/^data:image\/png;base64,/);
          const colored = await page.evaluate(async (url) => {
            const img = new Image();
            img.src = url;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 0; i < data.length; i += 4)
              if (
                data[i + 3] &&
                Math.max(data[i], data[i + 1], data[i + 2]) -
                  Math.min(data[i], data[i + 1], data[i + 2]) >
                  30
              )
                n++;
            return n;
          }, partial);
          expect(colored).toBeGreaterThan(20);
          partialImages[String(requested)] = partial;
        }
        // A later-task export must render afresh even after an unpreserved framebuffer was presented.
        const screen = await page
          .locator('canvas')
          .screenshot({ animations: 'disabled' });
        await page.waitForTimeout(60);
        const idleScreen = await page
          .locator('canvas')
          .screenshot({ animations: 'disabled' });
        expect(idleScreen.equals(screen)).toBe(true);
        presented[String(requested)] = screen;
        expect(await capture()).toBe(first);
        for (const view of [
          { x: 100000, y: 100000, zoom: 0.5 },
          { x: 0, y: 0, zoom: 0.5 },
        ])
          await page.evaluate(
            async ({ backend, view }) =>
              backend === 'core'
                ? window.corePathInstances.replayCamera(view)
                : await window.polylineLOD.replayCamera(view),
            { backend, view },
          );
        expect(await capture()).toBe(first);
        expect(
          await page.evaluate(
            (b) =>
              b === 'core'
                ? window.corePathInstances.replayDocument()
                : window.polylineLOD.replayDocument(),
            backend,
          ),
        ).toEqual(documentBefore);
        images[String(requested)] = first;
        const baseline = await page.evaluate(
          async (b) =>
            b === 'core'
              ? window.corePathInstances.destroy()
              : await window.polylineLOD.destroy(),
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
      }
      expect(images.false).toBe(images.true);
      expect(presented.false.equals(presented.true)).toBe(true);
      if (backend === 'ecs') {
        expect(partialImages.false).toBe(partialImages.true);
        expect(partialImages.undefined).toBe(partialImages.true);
      }
      expect(images.undefined).toBe(images[String(backend === 'ecs')]);
      expect(errors).toEqual([]);
    });
