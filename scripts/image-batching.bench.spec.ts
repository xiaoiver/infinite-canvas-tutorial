import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import { percentile } from '../examples/workflow-canvas/graph';
import type {} from '../__tests__/browser/fixtures/image-sharing';

test('paired Core/ECS ordered image pages with six alternating immutable sources', async ({
  browser,
}) => {
  test.setTimeout(300000);
  const git = (...a: string[]) =>
    execFileSync('git', a, { encoding: 'utf8' }).trim();
  const output =
    process.env.IMAGE_BATCH_BENCH_OUTPUT ?? '.test-results/image-batching.json';
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
    browser: browser.version(),
    node: process.version,
  };
  const results: unknown[] = [],
    references = new Map<string, Buffer>();
  mkdirSync(dirname(output), { recursive: true });
  for (const backend of ['core', 'ecs'])
    for (const enabled of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 1000, height: 760 },
        deviceScaleFactor: 1,
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.addInitScript(installProbes, { resourceStacks: false });
        await page.goto('/image-sharing.html?batching&backend=' + backend);
        await expect(page.locator('#status')).toHaveText('Ready');
        await page.evaluate(
          (enabled) => window.imageSharing.batching(enabled),
          enabled,
        );
        const start = Date.now();
        await page.evaluate(() => window.imageSharing.configure(1000, true, 6));
        const setupWallMs = Date.now() - start;
        const image = await page.evaluate(() => window.imageSharing.screen());
        const rgba =
          typeof image === 'string'
            ? PNG.sync.read(Buffer.from(image.split(',')[1], 'base64')).data
            : Buffer.from(image.rgba, 'base64');
        if (!enabled) references.set(backend, rgba);
        const reference = references.get(backend)!;
        let differentPixels = 0;
        for (let i = 0; i < rgba.length; i += 4)
          if (
            [0, 1, 2, 3].some(
              (c) => Math.abs(rgba[i + c] - reference[i + c]) > 3,
            )
          )
            differentPixels++;
        expect(differentPixels).toBeLessThan(20);
        const measured = await page.evaluate(() =>
          window.imageSharing.measure(30, 15),
        );
        expect(measured.samples).toHaveLength(30);
        expect(measured.state.visible).toBe(1000);
        expect(measured.state.webglError).toBe(0);
        for (const work of measured.native) {
          expect(work.drawcalls).toBe(enabled ? 5 : 1001);
          expect(work.indices).toBe(6000);
          expect(work.bufferBytes).toBe(192);
        }
        const teardown = await page.evaluate(() =>
          window.imageSharing.dispose(),
        );
        expect(teardown.restored).toBe(true);
        if (backend === 'core')
          expect(teardown.remaining).toEqual(teardown.baseline);
        else
          expect(
            await page.evaluate(() => window.lifecycleProbes.leaks()),
          ).toEqual([]);
        expect(errors).toEqual([]);
        const row = {
          backend,
          enabled,
          setupWallMs,
          ...measured,
          p50: percentile(measured.samples, 0.5),
          p95: percentile(measured.samples, 0.95),
          differentPixels,
          sha256: createHash('sha256').update(rgba).digest('hex'),
          teardown,
        };
        results.push(row);
        writeFileSync(
          output,
          JSON.stringify(
            {
              ...provenance,
              protocol:
                '1000 visible ordered image rectangles, six alternating immutable PNG sources; 15 warmup + 30 measured small pans; Core synchronous render, ECS complete async world.execute',
              results,
            },
            null,
            2,
          ) + '\n',
        );
        console.log(
          JSON.stringify({
            backend,
            enabled,
            visible: row.state.visible,
            p50: row.p50,
            p95: row.p95,
            native: row.native.at(-1),
            resources: row.state.resources,
            allocatedBufferBytes: row.state.allocatedBufferBytes,
            differentPixels,
          }),
        );
      } finally {
        await page.close();
      }
    }
});
