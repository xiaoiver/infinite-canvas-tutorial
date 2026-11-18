import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type { BatchingHarness } from '../__tests__/browser/fixtures/batching';

test('reproducible ordered solid batching benchmark', async ({ browser }) => {
  test.setTimeout(600_000);
  const results = [];
  for (const count of [1000, 10000]) {
    for (const batchable of [false, true]) {
      const page = await browser.newPage();
      await page.addInitScript(installProbes);
      await page.goto('/batching.html');
      await expect(page.locator('#status')).toHaveText('Ready');
      const result = await page.evaluate(
        async ({ count, batchable }) => {
          const h = (window as unknown as { batching: BatchingHarness })
            .batching;
          const result = await h.benchmark(count, batchable);
          return { ...result, resources: window.lifecycleProbes.resources() };
        },
        { count, batchable },
      );
      expect(result.visible).toBe(count);
      expect(result.drawcalls).toBe(
        batchable ? Math.ceil(count / 4096) : count,
      );
      results.push(result);
      console.log(JSON.stringify(result));
      mkdirSync('.test-results', { recursive: true });
      writeFileSync(
        '.test-results/batching-benchmark.json',
        JSON.stringify(results, null, 2),
      );
      await page.evaluate(() =>
        (window as unknown as { batching: BatchingHarness }).batching.destroy(),
      );
      expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
        [],
      );
      await page.close();
    }
  }
});
