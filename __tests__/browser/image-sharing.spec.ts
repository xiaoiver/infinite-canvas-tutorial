import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import { installProbes } from './fixtures/probes';
import type { ImagePatch } from './fixtures/image-sharing';

// The fixed-size GPU fixture must fit the viewport. Keep WebKit's mobile/DPR
// defaults; pointer/touch gestures have their own narrow-screen regressions.
test.use({
  viewport: { width: 1000, height: 760 },
  contextOptions: { screen: { width: 1000, height: 760 } },
});

async function textures(page: Page) {
  const state = await page.evaluate(() => window.imageSharing.state());
  expect(state.webglError).toBe(0);
  return state.resources.find((r) => r.side === 'images')!.live.Texture;
}

for (const backend of ['core', 'ecs'])
  test(`${backend} shares immutable images across edits, culling, peer deletion and exports`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('crash', () => {
      errors.push('image-sharing page crashed');
      console.error('image-sharing page crashed', backend);
    });
    page.on('console', (m) => {
      if (/GL_INVALID|GL_OUT_OF_MEMORY|CONTEXT_LOST/.test(m.text()))
        errors.push(m.text());
    });
    await page.addInitScript(installProbes);
    const reference: { label: string; png: PNG }[] = [];
    const observations: {
      initial: number;
      empty: number;
      reacquired: number;
      document: unknown;
    }[] = [];
    // Replay identical operations, releasing the first runtime before the next.
    // This follows the image benchmark and glyph-sharing regression pattern.
    // Multiple peer owners remain together inside each run.
    for (const shared of [false, true]) {
      console.info(
        'image-sharing mode',
        backend,
        shared ? 'shared' : 'private',
      );
      let checkpoint = 0;
      async function pixels(label: string, data?: string) {
        const capture =
          data ?? (await page.evaluate(() => window.imageSharing.screen()));
        const png =
          typeof capture === 'string'
            ? PNG.sync.read(Buffer.from(capture.split(',')[1], 'base64'))
            : new PNG({ width: capture.width, height: capture.height });
        if (typeof capture !== 'string')
          png.data = Buffer.from(capture.rgba, 'base64');
        expect(png.data.length).toBe(png.width * png.height * 4);
        if (label.startsWith('screen')) {
          expect([png.width, png.height]).toEqual([1000, 720]);
          let ink = 0;
          for (let i = 0; i < png.data.length; i += 4)
            if (png.data[i + 3] > 0 && png.data[i] < 200) ink++;
          expect(ink).toBeGreaterThan(100);
        }
        if (shared) {
          const expected = reference[checkpoint];
          expect(expected?.label).toBe(label);
          expect([png.width, png.height]).toEqual([
            expected.png.width,
            expected.png.height,
          ]);
          if (!png.data.equals(expected.png.data)) {
            await test.info().attach(label + '-reference', {
              body: PNG.sync.write(expected.png),
              contentType: 'image/png',
            });
            await test.info().attach(label + '-actual', {
              body: PNG.sync.write(png),
              contentType: 'image/png',
            });
          }
          expect(png.data.equals(expected.png.data), label).toBe(true);
        } else reference.push({ label, png });
        checkpoint++;
      }
      async function edit(index: number, patch: ImagePatch) {
        await page.evaluate(
          ({ index, patch }) => window.imageSharing.edit(index, patch),
          { index, patch },
        );
      }
      try {
        await page.goto(
          `/image-sharing.html?backend=${backend}${shared ? '' : '&private=1'}`,
        );
        await expect(page.locator('#status')).toHaveText('Ready', {
          timeout: 30000,
        });
        await page.evaluate(() => window.imageSharing.configure(12));
        expect(
          (await page.evaluate(() => window.imageSharing.state())).visible,
        ).toBe(12);
        const initial = await textures(page);
        console.info('image-sharing ready', backend, {
          shared,
          textures: initial,
          viewport: await page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            dpr: devicePixelRatio,
          })),
        });
        await pixels('screen-initial');
        expect(
          await page.evaluate(() => window.imageSharing.pick(20, 20)),
        ).toContain('image-0');
        expect(
          await page.evaluate(() => window.imageSharing.document()),
        ).toHaveLength(12);
        for (const [i, patch] of (
          [{ image: 1 }, { opacity: 0.4 }, { width: 31 }] as ImagePatch[]
        ).entries()) {
          await edit(0, patch);
          await pixels(`screen-edit-${i}`);
        }
        if (backend === 'ecs') {
          // Rebuild the same descriptor without reviving a retired binding.
          for (const [i, patch] of (
            [
              { objectFit: 'fill' },
              { filter: 'none' },
              { filter: '' },
            ] as ImagePatch[]
          ).entries()) {
            await edit(0, patch);
            await pixels(`screen-material-${i}`);
          }
          await edit(1, { objectFit: 'contain' });
          await pixels('screen-contain');
          await page.evaluate(() => window.imageSharing.history('undo'));
          await pixels('screen-undo');
          await page.evaluate(() => window.imageSharing.history('redo'));
          await pixels('screen-redo');
        }
        const beforeCull = await page.evaluate(() =>
          window.imageSharing.document(),
        );
        await page.evaluate(() => window.imageSharing.view(2000));
        expect(
          (await page.evaluate(() => window.imageSharing.state())).visible,
        ).toBe(0);
        await page.evaluate(() => window.imageSharing.view(0));
        expect(
          await page.evaluate(() => window.imageSharing.document()),
        ).toEqual(beforeCull);
        expect(
          await page.evaluate(() => window.imageSharing.pick(20, 20)),
        ).toContain('image-0');
        await pixels('screen-reentry');
        for (const partial of backend === 'ecs' ? [false, true] : [false])
          await pixels(
            `export-${partial ? 'node' : 'full'}`,
            await page.evaluate((p) => window.imageSharing.raster(p), partial),
          );
        await page.evaluate(() => window.imageSharing.remove(0));
        await pixels('screen-peer-deletion');
        if (backend === 'core') {
          await edit(0, { image: 'mutable' });
          await page.evaluate(() => window.imageSharing.mutate());
          await pixels('screen-mutable');
        }
        await page.evaluate(() => window.imageSharing.makeExternal());
        await edit(1, { image: 'external' });
        await pixels('screen-borrowed');
        const document = await page.evaluate(() =>
          window.imageSharing.document(),
        );
        await page.evaluate(() => window.imageSharing.configure(0));
        const empty = await textures(page);
        await page.evaluate(() => window.imageSharing.configure(12));
        const reacquired = await textures(page);
        await pixels('screen-reacquired');
        await page.evaluate(() => window.imageSharing.configure(12, true));
        await pixels('screen-batchable');
        if (shared) expect(checkpoint).toBe(reference.length);
        observations.push({ initial, empty, reacquired, document });
        const result = (await page.evaluate(() =>
          window.imageSharing.dispose(),
        ))!;
        expect(result.borrowedDestroyed).toBe(0);
        expect(result.restored).toBe(true);
        if (backend === 'core')
          expect(result.remaining).toEqual(result.baseline);
        else
          expect(
            await page.evaluate(() => window.lifecycleProbes.leaks()),
          ).toEqual([]);
        console.info('image-sharing complete', backend, {
          shared,
          checkpoints: checkpoint,
        });
      } finally {
        await page
          .evaluate(() => window.imageSharing?.dispose())
          .catch(() => {});
      }
    }
    expect(observations[0].initial - observations[1].initial).toBe(10);
    expect(observations[0].reacquired - observations[1].reacquired).toBe(10);
    expect(observations[0].empty).toBe(observations[1].empty);
    expect(observations[0].document).toEqual(observations[1].document);
    expect(errors).toEqual([]);
  });
