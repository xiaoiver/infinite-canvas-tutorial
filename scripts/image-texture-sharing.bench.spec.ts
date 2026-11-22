import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/image-sharing';

test('Core/ECS immutable image textures with a real private-upload reference', async ({
  browser,
}) => {
  test.setTimeout(300000);
  const output =
    process.env.IMAGE_SHARING_BENCH_OUTPUT ??
    '.test-results/image-texture-sharing.json';
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
    browser: browser.version(),
    node: process.version,
  };
  const results: unknown[] = [];
  mkdirSync(dirname(output), { recursive: true });
  const save = () =>
    writeFileSync(
      output,
      JSON.stringify({ ...provenance, results }, null, 2) + '\n',
    );
  const pixels = new Map<string, Buffer>(),
    work = new Map<string, unknown>();
  for (const backend of ['core', 'ecs'])
    for (const shared of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 1000, height: 760 },
        deviceScaleFactor: 1,
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (/GL_INVALID|GL_OUT_OF_MEMORY|CONTEXT_LOST/.test(m.text()))
          errors.push(m.text());
      });
      try {
        await page.addInitScript(installProbes, { resourceStacks: false });
        await page.goto(
          `/image-sharing.html?backend=${backend}${shared ? '' : '&private=1'}`,
        );
        await expect(page.locator('#status')).toHaveText('Ready', {
          timeout: 30000,
        });
        const start = performance.now();
        await page.evaluate(() => window.imageSharing.configure(1000));
        await expect
          .poll(() => page.evaluate(() => window.imageSharing.state().visible))
          .toBe(1000);
        const setupMs = performance.now() - start;
        const measured = await page.evaluate(() =>
          window.imageSharing.measure(30, 15),
        );
        expect(measured.samples).toHaveLength(30);
        expect(measured.native).toHaveLength(30);
        expect(measured.state.webglError).toBe(0);
        expect(measured.state.visible).toBe(1000);
        measured.native.forEach((n) => expect(n.drawcalls).toBeGreaterThan(0));
        await page.evaluate(() => window.imageSharing.view(0));
        const png = PNG.sync.read(await page.locator('#actual').screenshot());
        let ink = 0;
        for (let i = 0; i < png.data.length; i += 4)
          if (png.data[i] < 200) ink++;
        expect(ink).toBeGreaterThan(100000);
        const checksum = createHash('sha256').update(png.data).digest('hex');
        if (shared) {
          expect(png.data.equals(pixels.get(backend)!)).toBe(true);
          expect(measured.native).toEqual(work.get(backend));
        } else {
          pixels.set(backend, png.data);
          work.set(backend, measured.native);
        }
        const teardown = (await page.evaluate(() =>
          window.imageSharing.dispose(),
        ))!;
        expect(teardown.borrowedDestroyed).toBe(0);
        expect(teardown.restored).toBe(true);
        if (backend === 'core')
          expect(teardown.remaining).toEqual(teardown.baseline);
        else
          expect(
            await page.evaluate(() => window.lifecycleProbes.leaks()),
          ).toEqual([]);
        expect(errors).toEqual([]);
        const sorted = [...measured.samples].sort((a, b) => a - b);
        const result = {
          backend,
          shared,
          setupMs,
          checksum,
          ...measured,
          p50: sorted[15],
          p95: sorted[28],
          teardown,
        };
        results.push(result);
        save();
        console.log(
          JSON.stringify({
            backend,
            shared,
            setupMs,
            p50: result.p50,
            p95: result.p95,
            native: measured.native[0],
            state: measured.state,
          }),
        );
      } finally {
        await page
          .evaluate(() => window.imageSharing?.dispose())
          .catch(() => {});
        await page.close();
      }
    }
});
