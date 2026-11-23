import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/mixed-renderer';

test('Core/ECS idle hand-mode rendering with pixel and wake controls', async ({
  browser,
}) => {
  test.setTimeout(300000);
  const output =
    process.env.IDLE_RENDERING_BENCH_OUTPUT ??
    '.test-results/idle-rendering.json';
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
  const pixels = (url: string) =>
    PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')).data;
  for (const backend of ['core', 'ecs'])
    for (const mode of ['off', 'on']) {
      const page = await browser.newPage({
        viewport: { width: 1000, height: 720 },
        deviceScaleFactor: 1,
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.addInitScript(installProbes, { resourceStacks: false });
        await page.goto(`/mixed-renderer.html?backend=${backend}`);
        await expect(page.locator('output')).toHaveText('Ready');
        await page.evaluate(
          (enabled) => window.mixedRenderer.textBatching(enabled),
          mode === 'on',
        );
        const setup = await page.evaluate(() =>
          window.mixedRenderer.configure(1000, 'grouped', false, 200),
        );
        expect(setup.visible).toBe(1000);
        await page.evaluate(() => window.mixedRenderer.handMode());
        const before = await page.evaluate(() => window.mixedRenderer.raster());
        const idle = await page.evaluate(() =>
          window.mixedRenderer.measure('idle', 30, 15),
        );
        expect(idle.samples).toBe(30);
        expect(idle.phaseSamples).toEqual([]);
        expect(
          idle.nativeFrames.every(
            (frame) => frame.drawcalls === idle.native.drawcalls,
          ),
        ).toBe(true);
        const after = await page.evaluate(() => window.mixedRenderer.raster());
        expect(pixels(before).equals(pixels(after))).toBe(true);
        const wake = await page.evaluate(() =>
          window.mixedRenderer.measure('pan', 2, 1),
        );
        expect(wake.nonemptyFrames).toBe(2);
        const baseline = await page.evaluate(() =>
          window.mixedRenderer.destroy(),
        );
        const resources = await page.evaluate(() =>
          window.lifecycleProbes.resources(),
        );
        if (backend === 'core') expect(resources).toEqual(baseline);
        else
          expect(
            resources.every((context) =>
              Object.values(context.live).every((n) => n === 0),
            ),
          ).toBe(true);
        expect(errors).toEqual([]);
        results.push({
          ...provenance,
          backend,
          mode,
          setup,
          idle,
          wake,
          pixelsEqual: true,
          teardownPassed: true,
        });
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
        console.log(
          JSON.stringify({
            backend,
            mode,
            cpu: [idle.cpuP50, idle.cpuP95],
            nonempty: idle.nonemptyFrames,
            native: idle.native,
          }),
        );
      } finally {
        await page.close();
      }
    }
});
