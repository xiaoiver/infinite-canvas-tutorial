import { expect, type Page } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import { installProbes } from './fixtures/probes';
import type { ImagePatch } from './fixtures/image-sharing';
const textures = async (p: Page) =>
  (await p.evaluate(() => window.imageSharing.state())).resources.find(
    (r) => r.side === 'images',
  )!.live.Texture;
async function samePixels(a: Page, b: Page) {
  const aa = PNG.sync.read(await a.locator('#actual').screenshot()),
    bb = PNG.sync.read(await b.locator('#actual').screenshot());
  expect(aa.data.equals(bb.data)).toBe(true);
  let ink = 0;
  for (let i = 0; i < aa.data.length; i += 4) if (aa.data[i] < 200) ink++;
  expect(ink).toBeGreaterThan(100);
}
for (const backend of ['core', 'ecs'])
  test(`${backend} shares immutable images across edits, culling, peer deletion and exports`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    const ref = await context.newPage();
    const errors: string[] = [];
    try {
      for (const p of [page, ref]) {
        p.on('pageerror', (e) => errors.push(e.message));
        p.on('console', (m) => {
          if (/GL_INVALID|GL_OUT_OF_MEMORY|CONTEXT_LOST/.test(m.text()))
            errors.push(m.text());
        });
        await p.addInitScript(installProbes);
      }
      await page.goto(`/image-sharing.html?backend=${backend}`);
      await ref.goto(`/image-sharing.html?backend=${backend}&private=1`);
      for (const p of [page, ref]) {
        await expect(p.locator('#status')).toHaveText('Ready', {
          timeout: 30000,
        });
        await p.evaluate(() => window.imageSharing.configure(12));
      }
      await expect
        .poll(async () => (await textures(ref)) - (await textures(page)))
        .toBe(10);
      await samePixels(page, ref);
      expect(
        await page.evaluate(() => window.imageSharing.pick(20, 20)),
      ).toContain('image-0');
      const before = await page.evaluate(() => window.imageSharing.document());
      for (const patch of [
        { image: 1 },
        { opacity: 0.4 },
        { width: 31 },
      ] as ImagePatch[]) {
        for (const p of [page, ref])
          await p.evaluate(
            (patch) => window.imageSharing.edit(0, patch),
            patch,
          );
        await samePixels(page, ref);
      }
      if (backend === 'ecs') {
        // Explicit default fit and an inactive filter both rebuild the material;
        // they must not resurrect a retired binding or mutate a peer's texture.
        for (const patch of [
          { objectFit: 'fill' },
          { filter: 'none' },
          { filter: '' },
        ] as ImagePatch[]) {
          for (const p of [page, ref])
            await p.evaluate(
              (patch) => window.imageSharing.edit(0, patch),
              patch,
            );
          await samePixels(page, ref);
        }
        for (const p of [page, ref])
          await p.evaluate(() =>
            window.imageSharing.edit(1, { objectFit: 'contain' }),
          );
        await samePixels(page, ref);
        for (const p of [page, ref])
          await p.evaluate(() => window.imageSharing.history('undo'));
        await samePixels(page, ref);
        for (const p of [page, ref])
          await p.evaluate(() => window.imageSharing.history('redo'));
        await samePixels(page, ref);
      }
      const documentBeforeCull = await page.evaluate(() =>
        window.imageSharing.document(),
      );
      for (const p of [page, ref]) {
        await p.evaluate(() => window.imageSharing.view(2000));
        expect(
          (await p.evaluate(() => window.imageSharing.state())).visible,
        ).toBe(0);
      }
      for (const p of [page, ref])
        await p.evaluate(() => window.imageSharing.view(0));
      await samePixels(page, ref);
      expect(await page.evaluate(() => window.imageSharing.document())).toEqual(
        documentBeforeCull,
      );
      expect(
        await page.evaluate(() => window.imageSharing.pick(20, 20)),
      ).toContain('image-0');
      for (const partial of backend === 'ecs' ? [false, true] : [false]) {
        const a = await page.evaluate(
            (p) => window.imageSharing.raster(p),
            partial,
          ),
          b = await ref.evaluate((p) => window.imageSharing.raster(p), partial);
        const aa = PNG.sync.read(Buffer.from(a.split(',')[1], 'base64')),
          bb = PNG.sync.read(Buffer.from(b.split(',')[1], 'base64'));
        expect([aa.width, aa.height]).toEqual([bb.width, bb.height]);
        expect(aa.data.equals(bb.data)).toBe(true);
      }
      for (const p of [page, ref])
        await p.evaluate(() => window.imageSharing.remove(0));
      await samePixels(page, ref);
      if (backend === 'core') {
        for (const p of [page, ref]) {
          await p.evaluate(() =>
            window.imageSharing.edit(0, { image: 'mutable' }),
          );
          await p.evaluate(() => window.imageSharing.mutate());
        }
        await samePixels(page, ref);
      }
      for (const p of [page, ref]) {
        await p.evaluate(() => window.imageSharing.makeExternal());
        await p.evaluate(() =>
          window.imageSharing.edit(1, { image: 'external' }),
        );
      }
      await samePixels(page, ref);
      expect(before).toHaveLength(12);
      expect(await page.evaluate(() => window.imageSharing.document())).toEqual(
        await ref.evaluate(() => window.imageSharing.document()),
      );
      for (const p of [page, ref])
        await p.evaluate(() => window.imageSharing.configure(0));
      expect(await textures(page)).toBe(await textures(ref));
      for (const p of [page, ref])
        await p.evaluate(() => window.imageSharing.configure(12));
      await samePixels(page, ref);
      await expect
        .poll(async () => (await textures(ref)) - (await textures(page)))
        .toBe(10);
      for (const p of [page, ref])
        await p.evaluate(() => window.imageSharing.configure(12, true));
      await samePixels(page, ref);
      for (const p of [page, ref]) {
        const result = (await p.evaluate(() => window.imageSharing.dispose()))!;
        expect(result.borrowedDestroyed).toBe(0);
        expect(result.restored).toBe(true);
        if (backend === 'core')
          expect(result.remaining).toEqual(result.baseline);
        else
          expect(
            await p.evaluate(() => window.lifecycleProbes.leaks()),
          ).toEqual([]);
      }
      expect(errors).toEqual([]);
    } finally {
      for (const p of [page, ref])
        await p.evaluate(() => window.imageSharing?.dispose()).catch(() => {});
      await ref.close();
    }
  });
