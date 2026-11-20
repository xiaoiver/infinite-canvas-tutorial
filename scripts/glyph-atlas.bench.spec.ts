import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/glyph-atlas';

test('Core/ECS cold glyph atlas work and steady-state frames', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const destination =
    process.env.GLYPH_BENCH_OUTPUT ??
    '.test-results/glyph-atlas-benchmark.json';
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
    browser: browser.version(),
    node: process.version,
  };
  const results = [];
  mkdirSync(dirname(destination), { recursive: true });
  for (const backend of ['core', 'ecs']) {
    for (const mode of (process.env.GLYPH_BENCH_MODES ?? 'default,ascii').split(
      ',',
    )) {
      expect(['default', 'ascii']).toContain(mode);
      const page = await browser.newPage({
        viewport: { width: 1000, height: 720 },
        deviceScaleFactor: 1,
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => {
        errors.push(e.message);
        console.error(e.stack ?? e.message);
      });
      await page.addInitScript(installProbes);
      try {
        await page.goto(
          `/glyph-atlas.html?backend=${backend}&ascii=${Number(
            mode === 'ascii',
          )}`,
        );
        await expect(page.locator('output')).toHaveText('Ready');
        const setup = await page.evaluate(async () => {
          const start = performance.now();
          const state = await window.mixedRenderer.configure(
            1000,
            'grouped',
            false,
            200,
          );
          return {
            setupWallMs: performance.now() - start,
            state,
            glyphs: window.glyphAtlasProbe(),
          };
        });
        expect(setup.state.visible).toBe(1000);
        expect(setup.state.primitiveCounts.text).toBe(200);
        expect(setup.state.textProxy).toBe(0);
        expect(setup.state.webglError).toBe(0);
        const frames = await page.evaluate(() =>
          window.mixedRenderer.measure('pan', 30, 15),
        );
        expect(frames.samples).toBe(30);
        expect(frames.nonemptyFrames).toBe(30);
        expect(
          await page.evaluate(() => window.glyphAtlasProbe().glyphDraws),
        ).toBe(setup.glyphs.glyphDraws);
        const baseline = await page.evaluate(() =>
          window.mixedRenderer.destroy(),
        );
        const resources = await page.evaluate(() =>
          window.lifecycleProbes.resources(),
        );
        if (backend === 'core') expect(resources).toEqual(baseline);
        else
          expect(
            resources.every((c) => Object.values(c.live).every((n) => n === 0)),
          ).toBe(true);
        expect(errors).toEqual([]);
        results.push({
          ...provenance,
          backend,
          mode,
          ...setup,
          frames,
          teardownPassed: true,
        });
        writeFileSync(destination, JSON.stringify(results, null, 2) + '\n');
        console.log(
          JSON.stringify({
            backend,
            mode,
            ...setup.glyphs,
            setupWallMs: setup.setupWallMs,
            p50: frames.cpuP50,
            p95: frames.cpuP95,
          }),
        );
      } finally {
        await page.close();
      }
    }
  }
});
