import { test, expect } from '@playwright/test';
import { cpus, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type {} from '../__tests__/browser/fixtures/mixed-renderer';

test('mixed Core/ECS workload baseline', async ({ browser }) => {
  test.setTimeout(Number(process.env.MIXED_BENCH_TIMEOUT_MS ?? 1200000));
  const results = [];
  const sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
    encoding: 'utf8',
  }).trim();
  const textCap = Number(process.env.MIXED_BENCH_TEXT_CAP ?? 200);
  const destination =
    process.env.MIXED_BENCH_OUTPUT ??
    '.test-results/mixed-renderer-benchmark.json';
  const layouts = (
    process.env.MIXED_BENCH_LAYOUTS ?? 'grouped,interleaved'
  ).split(',');
  const modes = (process.env.MIXED_BENCH_MODES ?? 'off,on').split(',');
  expect(layouts.every((x) => ['grouped', 'interleaved'].includes(x))).toBe(
    true,
  );
  expect(modes.every((x) => ['off', 'on'].includes(x))).toBe(true);
  const counts = (process.env.MIXED_BENCH_COUNTS ?? '1000,10000')
    .split(',')
    .map(Number);
  const backends = (process.env.MIXED_BENCH_BACKENDS ?? 'core,ecs').split(',');
  expect(backends.every((x) => ['core', 'ecs'].includes(x))).toBe(true);
  expect(
    counts.every(
      (x) => Number.isInteger(x) && x >= 5 && x <= 10000 && x % 5 === 0,
    ),
  ).toBe(true);
  expect(Number.isInteger(textCap) && textCap > 0).toBe(true);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, '[]\n');
  for (const backend of backends)
    for (const count of counts)
      for (const layout of layouts as ('grouped' | 'interleaved')[])
        for (const mode of modes) {
          const enabled = mode === 'on';
          console.log(
            JSON.stringify({
              event: 'setup-start',
              backend,
              count,
              layout,
              enabled,
              textCap,
            }),
          );
          const page = await browser.newPage({
            deviceScaleFactor: 1,
            viewport: { width: 1000, height: 720 },
          });
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.addInitScript(installProbes);
          await page.goto(
            `http://127.0.0.1:4175/mixed-renderer.html?backend=${backend}`,
          );
          await expect(page.locator('output')).toHaveText('Ready');
          const setupWallMs = await page.evaluate(
            async ({ count, layout, enabled, textCap }) => {
              const start = performance.now();
              await window.mixedRenderer.configure(
                count,
                layout,
                enabled,
                textCap,
              );
              return performance.now() - start;
            },
            { count, layout, enabled, textCap },
          );
          for (const operation of ['pan', 'zoom', 'edit'] as const) {
            const result = await page.evaluate(
              (operation) => window.mixedRenderer.measure(operation),
              operation,
            );
            expect(result.visible).toBe(count);
            expect(result.webglError).toBe(0);
            expect(result.samples).toBe(30);
            expect(result.nonemptyFrames).toBe(30);
            expect(result.native.drawcalls).toBeGreaterThan(0);
            const row = {
              ...result,
              layout,
              enabled,
              browserVersion: browser.version(),
              nodeVersion: process.version,
              platform: process.platform,
              cpuModel: cpus()[0]?.model,
              cpuCount: cpus().length,
              memoryMiB: Math.round(totalmem() / 1024 / 1024),
              sourceHead,
              sourceTree,
              setupWallMs,
            };
            results.push(row);
            console.log(
              JSON.stringify({
                backend,
                count,
                layout,
                enabled,
                operation,
                p50: row.cpuP50,
                p95: row.cpuP95,
                visible: row.visible,
                native: row.native,
              }),
            );
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, JSON.stringify(results, null, 2));
          }
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
          await page.close();
        }
});
