import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import { installVertexUploadProbe } from '../__tests__/browser/fixtures/vertex-uploads';
import type {} from '../__tests__/browser/fixtures/core-path-instances';

test('Core paired 2400 translated cubic strokes', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installProbes);
  await page.addInitScript(installVertexUploadProbe);
  await page.goto('/core-path-instances.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const results = [];
  for (const enabled of [false, true]) {
    console.log('Core stroke mode', enabled);
    const result = await page.evaluate(
      (enabled) => window.corePathInstances.benchmarkStrokes(2400, enabled),
      enabled,
    );
    expect(result.visible).toBe(2400);
    expect(result.strokePages).toBe(enabled ? 10 : 0);
    expect(result.native.drawcalls).toBe(enabled ? 11 : 2401);
    results.push(result);
  }
  expect(results[1].native.indices).toBe(results[0].native.indices);
  const baseline = await page.evaluate(() =>
    window.corePathInstances.destroy(),
  );
  expect(await page.evaluate(() => window.lifecycleProbes.resources())).toEqual(
    baseline,
  );
  expect(errors).toEqual([]);
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const output =
    process.env.STROKE_BENCH_OUTPUT ??
    '.test-results/stroke-batching-core.json';
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        head: git('rev-parse', 'HEAD'),
        tree: git('rev-parse', 'HEAD^{tree}'),
        dirty: Boolean(git('status', '--porcelain')),
        browser: browser.version(),
        node: process.version,
        protocol:
          'Core 2400 translated cubic strokes; 10 warmup and 30 synchronous CPU camera frames per mode; preserves native segment work',
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify(
      results.map(({ enabled, visible, p50, p95, native, resources }) => ({
        enabled,
        visible,
        p50,
        p95,
        native,
        resources,
      })),
    ),
  );
});
