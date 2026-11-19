import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/core-path-instances';
test('core repeated Path fills and alternating geometry control', async ({
  browser,
}) => {
  test.setTimeout(600000);
  const results = [];
  for (const count of (process.env.PATH_INSTANCE_COUNTS ?? '600,1000')
    .split(',')
    .map(Number))
    for (const variants of [1, 2])
      for (const enabled of [false, true]) {
        const page = await browser.newPage({
          deviceScaleFactor: 1,
          viewport: { width: 1000, height: 750 },
        });
        await page.addInitScript(installProbes);
        await page.goto('http://127.0.0.1:4175/core-path-instances.html');
        await expect(page.locator('#status')).toHaveText('Ready');
        const result = await page.evaluate(
          ({ count, enabled, variants }) =>
            window.corePathInstances.benchmark(count, enabled, variants),
          { count, enabled, variants },
        );
        expect(result.visible).toBe(count);
        expect(result.samples).toBe(30);
        expect(result.native.drawcalls).toBe(
          enabled && variants === 1 ? 2 : count + 1,
        );
        expect(result.native.indices).toBe(count * 9);
        expect(result.native.bufferUploads).toBe(1);
        const row = {
          ...result,
          browserVersion: browser.version(),
          nodeVersion: process.version,
          platform: process.platform,
        };
        results.push(row);
        console.log(JSON.stringify(row));
        mkdirSync('.test-results', { recursive: true });
        writeFileSync(
          '.test-results/core-path-instancing-benchmark.json',
          JSON.stringify(results, null, 2),
        );
        const baseline = await page.evaluate(() =>
          window.corePathInstances.destroy(),
        );
        expect(
          await page.evaluate(() => window.lifecycleProbes.resources()),
        ).toEqual(baseline);
        await page.close();
      }
});
