import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/polyline-lod';
test('repeated filled Paths and alternating geometry control', async ({
  browser,
}) => {
  test.setTimeout(600000);
  const results = [];
  for (const count of (process.env.PATH_INSTANCE_COUNTS ?? '600,1000')
    .split(',')
    .map(Number)) {
    for (const variants of [1, 2])
      for (const enabled of [false, true]) {
        const page = await browser.newPage({
          deviceScaleFactor: 1,
          viewport: { width: 1000, height: 750 },
        });
        await page.addInitScript(installProbes);
        await page.goto('http://127.0.0.1:4175/polyline-lod.html');
        await expect(page.locator('#status')).toHaveText('Ready', {
          timeout: 30000,
        });
        const {
          document: _doc,
          segments: _segments,
          ...result
        } = await page.evaluate(
          async ({ count, enabled, variants }) =>
            window.polylineLOD.benchmarkPaths(count, enabled, variants),
          { count, enabled, variants },
        );
        expect(result.visible).toBe(count);
        expect(result.samples).toBe(30);
        expect(result.native.drawcalls).toBe(result.drawcalls + 1);
        expect(result.native.indices).toBe(count * 9);
        expect(result.native.bufferUploads).toBe(1);
        expect(result.drawcalls).toBe(
          enabled && variants === 1 ? Math.ceil(count / 4096) : count,
        );
        const row = {
          ...result,
          variants,
          browserVersion: browser.version(),
          nodeVersion: process.version,
          platform: process.platform,
        };
        results.push(row);
        console.log(JSON.stringify(row));
        mkdirSync('.test-results', { recursive: true });
        writeFileSync(
          '.test-results/path-instancing-benchmark.json',
          JSON.stringify(results, null, 2),
        );
        await page.evaluate(() => window.polylineLOD.destroy());
        expect(
          await page.evaluate(() => window.lifecycleProbes.leaks()),
        ).toEqual([]);
        await page.close();
      }
  }
});
