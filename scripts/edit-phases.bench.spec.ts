import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import type { FramePhases } from '../__tests__/browser/fixtures/frame-phase-probe';
import type {} from '../__tests__/browser/fixtures/glyph-atlas';

const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * fraction)];
};
function summarize(samples: FramePhases[], cpu: number[]) {
  const names = [...new Set(samples.flatMap((frame) => Object.keys(frame)))];
  const phases = names
    .map((name) => {
      const exclusive = samples.map((frame) => frame[name]?.exclusiveMs ?? 0);
      const inclusive = samples.map((frame) => frame[name]?.inclusiveMs ?? 0);
      return {
        name,
        calls: samples.reduce(
          (sum, frame) => sum + (frame[name]?.calls ?? 0),
          0,
        ),
        meanExclusiveMs: exclusive.reduce((a, b) => a + b, 0) / samples.length,
        p50ExclusiveMs: percentile(exclusive, 0.5),
        p95ExclusiveMs: percentile(exclusive, 0.95),
        p50InclusiveMs: percentile(inclusive, 0.5),
        p95InclusiveMs: percentile(inclusive, 0.95),
      };
    })
    .sort((a, b) => b.meanExclusiveMs - a.meanExclusiveMs);
  const residual = samples.map(
    (frame, index) =>
      cpu[index] -
      Object.values(frame).reduce((sum, timing) => sum + timing.exclusiveMs, 0),
  );
  return {
    phases,
    residual: {
      meanMs: residual.reduce((a, b) => a + b, 0) / residual.length,
      p50Ms: percentile(residual, 0.5),
      p95Ms: percentile(residual, 0.95),
    },
    tailFrames: cpu
      .map((cpuMs, index) => ({
        index,
        cpuMs,
        residualMs: residual[index],
        phases: samples[index],
      }))
      .sort((a, b) => b.cpuMs - a.cpuMs)
      .slice(0, 3),
  };
}

test('Core/ECS edit phases with unprofiled controls and restored methods', async ({
  browser,
}) => {
  test.setTimeout(300000);
  const destination =
    process.env.EDIT_PHASES_BENCH_OUTPUT ??
    '.test-results/edit-phases-benchmark.json';
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
  writeFileSync(destination, '[]\n');
  for (const backend of ['core', 'ecs'])
    for (const mode of ['off', 'on']) {
      const page = await browser.newPage({
        viewport: { width: 1000, height: 720 },
        deviceScaleFactor: 1,
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(installProbes);
      try {
        await page.goto(`/glyph-atlas.html?backend=${backend}`);
        await expect(page.locator('output')).toHaveText('Ready');
        await page.evaluate(
          (enabled) => window.mixedRenderer.textBatching(enabled),
          mode === 'on',
        );
        const setup = await page.evaluate(() =>
          window.mixedRenderer.configure(1000, 'grouped', false, 200),
        );
        expect(setup.visible).toBe(1000);
        expect(setup.textProxy).toBe(0);
        const control = await page.evaluate(() =>
          window.mixedRenderer.measure('edit', 30, 15),
        );
        expect(control.phaseSamples).toEqual([]);
        const coverage = await page.evaluate(() =>
          window.mixedRenderer.profile(true),
        );
        const profiled = await page.evaluate(() =>
          window.mixedRenderer.measure('edit', 30, 15),
        );
        expect(profiled.phaseSamples).toHaveLength(30);
        expect(profiled.visible).toBe(1000);
        expect(profiled.samples).toBe(30);
        expect(profiled.nonemptyFrames).toBe(30);
        expect(profiled.native).toEqual(control.native);
        expect(profiled.orderSignals).toBe(control.orderSignals);
        expect(profiled.allocatedBufferBytes).toBe(
          control.allocatedBufferBytes,
        );
        expect(profiled.resources).toEqual(control.resources);
        expect(profiled.webglError).toBe(0);
        profiled.phaseSamples.forEach((frame, index) => {
          expect(
            Object.values(frame).reduce(
              (sum, timing) => sum + timing.exclusiveMs,
              0,
            ),
          ).toBeLessThanOrEqual(profiled.cpuSamplesMs[index] + 0.1);
        });
        await page.evaluate(() => window.mixedRenderer.profile(false));
        const restored = await page.evaluate(() =>
          window.mixedRenderer.measure('edit', 2, 1),
        );
        expect(restored.phaseSamples).toEqual([]);
        expect(restored.native).toEqual(control.native);
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
        const summary = summarize(profiled.phaseSamples, profiled.cpuSamplesMs);
        results.push({
          ...provenance,
          backend,
          mode,
          setup,
          control,
          profiled,
          restored,
          summary,
          coverage,
          teardownPassed: true,
        });
        writeFileSync(destination, JSON.stringify(results, null, 2) + '\n');
        console.log(
          JSON.stringify({
            backend,
            mode,
            control: [control.cpuP50, control.cpuP95],
            profiled: [profiled.cpuP50, profiled.cpuP95],
            phases: summary.phases.slice(0, 5),
            residual: summary.residual,
          }),
        );
      } finally {
        await page.close();
      }
    }
});
