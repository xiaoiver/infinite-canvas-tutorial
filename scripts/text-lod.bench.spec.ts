import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type { TextLODHarness } from '../__tests__/browser/fixtures/text-lod';

test('text LOD reproducible CPU and submitted-work benchmark', async ({
  browser,
}) => {
  test.setTimeout(600000);
  const results = [];
  const counts = (process.env.TEXT_LOD_COUNTS ?? '1000,10000')
    .split(',')
    .map(Number);
  // Default to the two proxy modes; full 10k construction is a known expensive workload.
  const modes = (process.env.TEXT_LOD_MODES ?? 'on,batched').split(',');
  if (modes.some((mode) => !['off', 'on', 'batched'].includes(mode)))
    throw new Error('TEXT_LOD_MODES must contain off/on/batched');
  for (const count of counts) {
    for (const mode of modes) {
      const enabled = mode !== 'off';
      const batchable = mode === 'batched';
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { width: 1000, height: 750 },
      });
      page.on('console', (message) => {
        if (message.text().startsWith('text-lod benchmark:'))
          console.log(message.text());
      });
      page.on('pageerror', (error) => console.error(error.message));
      await page.addInitScript(installProbes);
      await page.goto('http://127.0.0.1:4175/text-lod.html');
      await expect(page.locator('#status')).toHaveText('Ready');
      const result = await page.evaluate(
        async ({ count, enabled, batchable }) => {
          const h = (window as unknown as { textLOD: TextLODHarness }).textLOD;
          return h.benchmark(count, enabled, 90, batchable);
        },
        { count, enabled, batchable },
      );
      expect(result.visible).toBe(count);
      if (enabled) expect(result.vertices).toBe(count * 8);
      if (batchable)
        expect(result.drawcalls).toBe(Math.ceil((count * 2) / 4096));
      results.push(result);
      writeFileSync(
        '.test-results/text-lod-benchmark.json',
        JSON.stringify(results, null, 2),
      );
      console.log(JSON.stringify(result));
      await page.evaluate(() => (window as any).textLOD.destroy());
      await page.close();
    }
  }
  writeFileSync(
    '.test-results/text-lod-benchmark.json',
    JSON.stringify(results, null, 2),
  );
});
