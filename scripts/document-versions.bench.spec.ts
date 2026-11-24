import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import { percentile } from '../examples/workflow-canvas/graph';
import type {} from '../examples/workflow-canvas/benchmark-entry';
import type {} from '../examples/workflow-canvas/main';

test('unchanged Workflow commits retain versions and snapshot ownership', async ({
  browser,
}) => {
  // Baseline-only assertion override; the workload itself is unchanged.
  const idleDraws = Number(process.env.WORKFLOW_BENCH_EXPECT_IDLE_DRAWS ?? '0');
  if (![0, 22].includes(idleDraws)) throw new Error('Expected idle draws must be 0 or 22');
  const output =
    process.env.DOCUMENT_VERSIONS_BENCH_OUTPUT ??
    '.test-results/document-versions.json';
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    tree: git('rev-parse', 'HEAD^{tree}'),
    dirty: !!git('status', '--porcelain'),
    browser: browser.version(),
    node: process.version,
  };
  const page = await browser.newPage({
    viewport: { width: 1500, height: 980 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(installProbes, { resourceStacks: false });
    await page.goto('/?imageBatching=1');
    await page.waitForFunction(() => window.workflowDemo?.snapshot().ready);
    await page.locator('#scale').selectOption('2400');
    await page.waitForFunction(
      () =>
        window.workflowDemo.snapshot().ready &&
        window.workflowDemo.snapshot().renderedNodes === 2400,
    );
    await page.locator('#overview').click();
    await expect
      .poll(() =>
        page.evaluate(() => window.workflowBenchmark.state().visible.cards),
      )
      .toBe(2400);
    await page.evaluate(() => window.workflowBenchmark.collect(3, 0));
    const capture = await page.evaluate(() =>
      window.workflowBenchmark.recordUnchanged(),
    );
    expect(capture.before.theme).toEqual(capture.before.requestedTheme);
    expect(capture.after.theme).toEqual(capture.after.requestedTheme);
    expect(capture.before.theme?.background).toBe('#171b18');
    expect(capture.captures).toHaveLength(30);
    expect(capture.frames).toHaveLength(30);
    expect(capture.observerRestored).toBe(true);
    for (const frame of capture.frames) {
      expect(frame.native.drawcalls).toBe(idleDraws);
      expect(frame.native.indices).toBe(idleDraws ? 614406 : 0);
    }
    expect(capture.after.visible).toEqual(capture.before.visible);
    expect(capture.after.resources).toEqual(capture.before.resources);
    expect(capture.after.allocatedBufferBytes).toBe(
      capture.before.allocatedBufferBytes,
    );
    const restored = await page.evaluate(() =>
      window.workflowBenchmark.collect(2, 0),
    );
    expect(restored).toHaveLength(2);
    const summary = {
      snapshotReuses: capture.captures.filter((s) => s.reused).length,
      elementMapReuses: capture.captures.filter((s) => s.elementsReused).length,
      snapshotP50: percentile(
        capture.captures.map((s) => s.elapsedMs),
        0.5,
      ),
      snapshotP95: percentile(
        capture.captures.map((s) => s.elapsedMs),
        0.95,
      ),
      cpuP50: percentile(
        capture.frames.map((f) => f.elapsed),
        0.5,
      ),
      cpuP95: percentile(
        capture.frames.map((f) => f.elapsed),
        0.95,
      ),
    };
    const teardown = await page.evaluate(() =>
      window.workflowBenchmark.dispose(),
    );
    expect(Object.values(teardown).every(Boolean)).toBe(true);
    expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
      [],
    );
    expect(errors).toEqual([]);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(
      output,
      JSON.stringify(
        { ...provenance, capture, restored, summary, teardownPassed: true },
        null,
        2,
      ) + '\n',
    );
    console.log(
      JSON.stringify({ versions: capture.after.documentVersions, ...summary }),
    );
  } finally {
    await page.close();
  }
});
