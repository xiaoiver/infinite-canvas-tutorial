import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/image-sharing';

test.use({
  viewport: { width: 1000, height: 760 },
  contextOptions: { screen: { width: 1000, height: 760 } },
});
async function pixels(page: Page) {
  const image = await page.evaluate(() => window.imageSharing.screen());
  return typeof image === 'string'
    ? PNG.sync.read(Buffer.from(image.split(',')[1], 'base64')).data
    : Buffer.from(image.rgba, 'base64');
}
function equivalent(actual: Buffer, reference: Buffer) {
  expect(actual.length).toBe(reference.length);
  let difference = 0,
    ink = 0;
  for (let i = 0; i < actual.length; i += 4) {
    if (reference[i] < 240 || reference[i + 1] < 240 || reference[i + 2] < 240)
      ink++;
    if (
      [0, 1, 2, 3].some((c) => Math.abs(actual[i + c] - reference[i + c]) > 3)
    )
      difference++;
  }
  expect(ink).toBeGreaterThan(200);
  expect(difference).toBeLessThan(20);
}
for (const backend of ['core', 'ecs'] as const)
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
      await page.goto('/image-sharing.html?batching&backend=' + backend);
      await expect(page.locator('#status')).toHaveText('Ready');
    });
    test.afterEach(async ({ page }) => {
      const state = await page.evaluate(() => window.imageSharing.dispose());
      expect(state.restored).toBe(true);
      expect(state.borrowedDestroyed).toBe(0);
      if (backend === 'core') expect(state.remaining).toEqual(state.baseline);
      else
        expect(
          await page.evaluate(() => window.lifecycleProbes.leaks()),
        ).toEqual([]);
      expect(errors).toEqual([]);
    });
    test('defaults off; 300 alternating six-image rectangles share two pages and preserve pixels/indices', async ({
      page,
    }) => {
      await page.evaluate(() => window.imageSharing.configure(300, true, 6));
      const full = await pixels(page);
      const before = await page.evaluate(() =>
        window.imageSharing.measure(2, 1),
      );
      expect(before.state.visible).toBe(300);
      expect(before.native.at(-1).drawcalls).toBe(301);
      await page.evaluate(() => window.imageSharing.batching(true));
      equivalent(await pixels(page), full);
      const after = await page.evaluate(() =>
        window.imageSharing.measure(2, 1),
      );
      expect(after.state.visible).toBe(300);
      expect(after.native.at(-1).drawcalls).toBe(3);
      expect(after.native.at(-1).indices).toBe(before.native.at(-1).indices);
      expect(after.native.at(-1).bufferBytes).toBe(192);
    });
    test('a ninth texture splits pages without crossing painter order', async ({
      page,
    }) => {
      await page.evaluate(() => window.imageSharing.configure(18, true, 9));
      const full = await pixels(page);
      await page.evaluate(() => window.imageSharing.batching(true));
      equivalent(await pixels(page), full);
      const after = await page.evaluate(() =>
        window.imageSharing.measure(2, 1),
      );
      expect(after.native.at(-1).drawcalls).toBe(4);
    });
    test('overlap and painter barriers, affine edits, source swaps and style fallback retain full pixels', async ({
      page,
    }) => {
      await page.evaluate(() => window.imageSharing.overlap(true));
      const document = await page.evaluate(() =>
        window.imageSharing.document(),
      );
      const picked = await page.evaluate(() =>
        window.imageSharing.pick(100, 100),
      );
      expect(picked).toContain('image-0');
      await page.evaluate(() => window.imageSharing.batching(true));
      expect(
        await page.evaluate(() => window.imageSharing.pick(100, 100)),
      ).toEqual(picked);
      expect(
        (
          await page.evaluate(() => window.imageSharing.measure(2, 1))
        ).native.at(-1).drawcalls,
      ).toBe(4);
      const edits = [
        { kind: 'style', patch: { rotation: 0.3 } },
        { kind: 'edit', patch: { opacity: 0.35, width: 112, image: 4 } },
        { kind: 'style', patch: { cornerRadius: 5 } },
      ] as const;
      for (const edit of [null, ...edits]) {
        if (edit)
          await page.evaluate(async (edit) => {
            if (edit.kind === 'style')
              await window.imageSharing.style(0, edit.patch);
            else await window.imageSharing.edit(0, edit.patch);
          }, edit);
        await page.evaluate(() => window.imageSharing.batching(false));
        const full = await pixels(page);
        await page.evaluate(() => window.imageSharing.batching(true));
        equivalent(await pixels(page), full);
      }
      expect(document.length).toBe(4);
    });
    test('exports, culling/reentry, same-frame deletion and runtime disable retire pages safely', async ({
      page,
    }) => {
      await page.evaluate(() => window.imageSharing.configure(12, true, 6));
      await page.evaluate(() => window.imageSharing.batching(true));
      const before = await page.evaluate(() => window.imageSharing.document());
      for (const partial of [false, true]) {
        const on = await page.evaluate(
          (partial) => window.imageSharing.raster(partial),
          partial,
        );
        await page.evaluate(() => window.imageSharing.batching(false));
        const off = await page.evaluate(
          (partial) => window.imageSharing.raster(partial),
          partial,
        );
        expect(on).toBe(off);
        await page.evaluate(() => window.imageSharing.batching(true));
      }
      expect(await page.evaluate(() => window.imageSharing.document())).toEqual(
        before,
      );
      await page.evaluate(() => window.imageSharing.view(10000));
      expect(
        (await page.evaluate(() => window.imageSharing.state())).visible,
      ).toBe(0);
      await page.evaluate(() => window.imageSharing.view(0));
      expect(
        (await page.evaluate(() => window.imageSharing.state())).visible,
      ).toBe(12);
      await page.evaluate(() => window.imageSharing.removeDuringView(0));
      expect(
        (await page.evaluate(() => window.imageSharing.state())).visible,
      ).toBe(11);
      await page.evaluate(() => window.imageSharing.configure(0, true, 6));
      expect(
        (await page.evaluate(() => window.imageSharing.state())).visible,
      ).toBe(0);
    });
    test('WebGL1 preserves image pixels within six attributes and eight samplers', async ({
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
      await page.evaluate(() => window.imageSharing.configure(9, true, 9));
      const full = await pixels(page);
      await page.evaluate(() => window.imageSharing.batching(true));
      equivalent(await pixels(page), full);
    });
    if (backend === 'ecs')
      test('native hover/selection, undo/redo and camera migration use original entities', async ({
        page,
      }) => {
        await page.evaluate(() => window.imageSharing.configure(12, true, 6));
        await page.evaluate(() => window.imageSharing.batching(true));
        await page.mouse.move(18, 18);
        await expect
          .poll(() =>
            page.evaluate(() => window.imageSharing.interaction().highlighted),
          )
          .toBe(true);
        await page.mouse.click(18, 18);
        await expect
          .poll(() =>
            page.evaluate(() => window.imageSharing.interaction().selected),
          )
          .toBe(true);
        expect(
          await page.evaluate(() => window.imageSharing.pick(18, 18)),
        ).toContain('image-0');
        await page.evaluate(() => window.imageSharing.edit(0, { width: 70 }));
        await page.evaluate(() => window.imageSharing.history('undo'));
        expect(
          (await page.evaluate(() => window.imageSharing.document()))[0].width,
        ).toBe(24);
        await page.evaluate(() => window.imageSharing.history('redo'));
        expect(
          (await page.evaluate(() => window.imageSharing.document()))[0].width,
        ).toBe(70);
        for (const back of [false, true]) {
          const memberships = await page.evaluate(
            (back) => window.imageSharing.moveCamera(back),
            back,
          );
          expect(
            memberships.flat().filter((id) => id === 'image-0'),
          ).toHaveLength(1);
        }
      });
    if (backend === 'core')
      test('image option never changes the existing capture planner', async ({
        page,
      }) => {
        await page.evaluate(() => window.imageSharing.overlap(true));
        await page.evaluate(() => window.imageSharing.ordered(false));
        await page.evaluate(() => window.imageSharing.batching(false));
        const full = await page.evaluate(() => window.imageSharing.raster());
        await page.evaluate(() => window.imageSharing.batching(true));
        expect(await page.evaluate(() => window.imageSharing.raster())).toBe(
          full,
        );
      });
    test('borrowed and mutable/effect image fallbacks preserve pixels and ownership', async ({
      page,
    }) => {
      await page.evaluate(() => window.imageSharing.configure(12, true, 6));
      await page.evaluate(() => window.imageSharing.makeExternal());
      await page.evaluate(() => window.imageSharing.batching(true));
      await page.evaluate(() =>
        window.imageSharing.edit(0, { image: 'external' }),
      );
      if (backend === 'core') {
        await page.evaluate(() =>
          window.imageSharing.edit(1, { image: 'mutable' }),
        );
        await page.evaluate(() => window.imageSharing.mutate());
      } else {
        await page.evaluate(() =>
          window.imageSharing.edit(1, { objectFit: 'contain', opacity: 0.5 }),
        );
      }
      const on = await pixels(page);
      await page.evaluate(() => window.imageSharing.batching(false));
      equivalent(await pixels(page), on);
      if (backend === 'ecs') {
        await page.evaluate(() =>
          window.imageSharing.edit(1, { filter: 'blur(2px)' }),
        );
        const full = await pixels(page);
        await page.evaluate(() => window.imageSharing.batching(true));
        equivalent(await pixels(page), full);
      }
    });
    test('full and batched peers can share a source across multiple sampler pages', async ({
      page,
    }) => {
      await page.evaluate(() => window.imageSharing.configure(18, true, 9));
      await page.evaluate(() =>
        window.imageSharing.style(0, { cornerRadius: 5 }),
      );
      const full = await pixels(page);
      await page.evaluate(() => window.imageSharing.batching(true));
      equivalent(await pixels(page), full);
      await page.evaluate(() => window.imageSharing.view(0.25));
      await page.evaluate(() => window.imageSharing.batching(false));
      const moved = await pixels(page);
      await page.evaluate(() => window.imageSharing.batching(true));
      equivalent(await pixels(page), moved);
    });
  });
