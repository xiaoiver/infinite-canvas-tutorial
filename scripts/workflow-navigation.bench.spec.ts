import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import { percentile } from '../examples/workflow-canvas/graph';
import type {} from '../examples/workflow-canvas/benchmark-entry';
import type {} from '../examples/workflow-canvas/main';

test('real workflow navigation at 2400 cards and 2400 edges', async ({
  browser,
}) => {
  const output =
    process.env.WORKFLOW_BENCH_OUTPUT ??
    '.test-results/workflow-navigation.json';
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: Boolean(git('status', '--porcelain')),
    browser: browser.version(),
    node: process.version,
  };
  mkdirSync(dirname(output), { recursive: true });
  const results: unknown[] = [];
  const save = () =>
    writeFileSync(
      output,
      JSON.stringify({ ...provenance, results }, null, 2) + '\n',
    );
  for (const profiled of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 980 },
      deviceScaleFactor: 1,
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addInitScript(installProbes, { resourceStacks: false });
      await page.goto('/');
      await page.waitForFunction(() => window.workflowDemo?.snapshot().ready);
      await page.locator('#scale').selectOption('2400');
      await page.waitForFunction(
        () => {
          const s = window.workflowDemo.snapshot();
          return (
            s.ready && s.renderedNodes === 2400 && s.renderedEdges === 2400
          );
        },
        null,
        { timeout: 120000 },
      );
      await page.evaluate(() => window.workflowBenchmark.begin());
      await page.locator('#overview').click();
      await expect
        .poll(
          () =>
            page.evaluate(() => window.workflowBenchmark.state().visible.cards),
          { timeout: 120000 },
        )
        .toBe(2400);
      const transition = await page.evaluate(() =>
        window.workflowBenchmark.end(),
      );
      results.push({
        profiled: false,
        operation: 'cold-overview-transition',
        frames: transition,
      });
      save();
      await page.evaluate(
        (enabled) => window.workflowBenchmark.profile(enabled),
        profiled,
      );
      const start = await page.evaluate(() => window.workflowBenchmark.state());
      const frames = await page.evaluate(() =>
        window.workflowBenchmark.collect(30, 5),
      );
      const scopes = new Map<string, number>();
      for (const f of frames)
        for (const [name, v] of Object.entries(f.phases ?? {}))
          scopes.set(
            name,
            (scopes.get(name) ?? 0) + v.exclusiveMs / frames.length,
          );
      results.push({ profiled, operation: 'steady-overview', start, frames });
      save();
      console.log(
        JSON.stringify({
          profiled,
          operation: 'steady-overview',
          frames: frames.length,
          p50: percentile(
            frames.map((f) => f.elapsed),
            0.5,
          ),
          p95: percentile(
            frames.map((f) => f.elapsed),
            0.95,
          ),
          native: frames.at(-1)?.native,
          phases: [...scopes].sort((a, b) => b[1] - a[1]),
        }),
      );
      await page.evaluate(() => window.workflowBenchmark.begin());
      await page.locator('#benchmark').click();
      await expect(page.locator('#benchmark-result')).toBeVisible({
        timeout: 45000,
      });
      const tour = await page.evaluate(() => window.workflowBenchmark.end());
      results.push({
        profiled,
        operation: 'time-driven-tour',
        frames: tour,
        result: await page.locator('#benchmark-result').textContent(),
      });
      save();
      console.log(
        JSON.stringify({
          profiled,
          operation: 'time-driven-tour',
          frames: tour.length,
          p50: percentile(
            tour.map((f) => f.elapsed),
            0.5,
          ),
          p95: percentile(
            tour.map((f) => f.elapsed),
            0.95,
          ),
        }),
      );
      expect(
        await page.evaluate(() => window.workflowBenchmark.dispose()),
      ).toEqual({ run: true, createCanvas: true, submit: true, context: true });
      expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
        [],
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }
});
