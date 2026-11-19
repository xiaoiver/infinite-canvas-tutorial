import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type { PolylineLODHarness } from '../__tests__/browser/fixtures/polyline-lod';
test('mixed rectangles, adaptive paths and sampled polylines', async ({
  browser,
}) => {
  test.setTimeout(600000);
  const results = [];
  for (const count of (process.env.POLYLINE_LOD_COUNTS ?? '150,600')
    .split(',')
    .map(Number)) {
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
        document: _nodes,
        segments,
        ...result
      } = await page.evaluate(
        async ({ count, enabled }) => {
          return (
            window as unknown as { polylineLOD: PolylineLODHarness }
          ).polylineLOD.benchmark(count, enabled);
        },
        { count, enabled },
      );
      expect(result.visible).toBe(count);
      const row = {
        ...result,
        browserVersion: browser.version(),
        nodeVersion: process.version,
        platform: process.platform,
        polylineAndPathSegmentInstances: segments.reduce((a, b) => a + b, 0),
      };
      results.push(row);
      console.log(JSON.stringify(row));
      mkdirSync('.test-results', { recursive: true });
      writeFileSync(
        '.test-results/polyline-lod-benchmark.json',
        JSON.stringify(results, null, 2),
      );
      await page.evaluate(() => window.polylineLOD.destroy());
      await page.close();
    }
  }
});
