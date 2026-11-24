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
  // Baseline-only assertion override; the workload itself is unchanged.
  const idleDraws = Number(process.env.WORKFLOW_BENCH_EXPECT_IDLE_DRAWS ?? '0');
  if (![0, 22].includes(idleDraws)) throw new Error('Expected idle draws must be 0 or 22');
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
  // Optional focused runs retain the normal four-case default.
  const modes = (value: string | undefined) =>
    value === undefined ? [false, true] : value === '1' ? [true] : value === '0' ? [false] : (() => { throw new Error('Use 0 or 1 for benchmark mode filters'); })();
  for (const imageBatching of modes(process.env.WORKFLOW_BENCH_IMAGES))
    for (const profiled of modes(process.env.WORKFLOW_BENCH_PROFILE)) {
      const page = await browser.newPage({
        viewport: { width: 1500, height: 980 },
        deviceScaleFactor: 1,
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.addInitScript(installProbes, { resourceStacks: false });
        await page.goto('/?imageBatching=' + Number(imageBatching));
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
              page.evaluate(
                () => window.workflowBenchmark.state().visible.cards,
              ),
            { timeout: 120000 },
          )
          .toBe(2400);
        const transition = await page.evaluate(() =>
          window.workflowBenchmark.end(),
        );
        results.push({
          imageBatching,
          profiled: false,
          operation: 'cold-overview-transition',
          frames: transition,
        });
        save();
        await page.evaluate(
          (enabled) => window.workflowBenchmark.profile(enabled),
          profiled,
        );
        const start = await page.evaluate(() =>
          window.workflowBenchmark.state(),
        );
        expect(start.visible.edges).toBe(2400);
        expect(start.theme).toEqual(start.requestedTheme);
        expect(start.theme?.background).toBe('#171b18');
        const frames = await page.evaluate(() =>
          window.workflowBenchmark.collect(30, 5),
        );
        for (const frame of frames) {
          expect(frame.native.drawcalls).toBe(idleDraws ? (imageBatching ? 22 : 2412) : 0);
          expect(frame.native.indices).toBe(idleDraws ? 614406 : 0);
        }
        const scopes = new Map<string, number>();
        for (const f of frames)
          for (const [name, v] of Object.entries(f.phases ?? {}))
            scopes.set(
              name,
              (scopes.get(name) ?? 0) + v.exclusiveMs / frames.length,
            );
        results.push({
          imageBatching,
          profiled,
          operation: 'steady-overview',
          start,
          frames,
        });
        save();
        console.log(
          JSON.stringify({
            imageBatching,
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
          imageBatching,
          profiled,
          operation: 'time-driven-tour',
          frames: tour,
          result: await page.locator('#benchmark-result').textContent(),
        });
        save();
        console.log(
          JSON.stringify({
            imageBatching,
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
        // A reproducible native-pointer drag at a readable zoom in a 2400-node
        // document. Report actual visibility separately from the all-visible overview.
        await page.locator('#overview').click();
        while (
          (await page.evaluate(
            () => window.workflowDemo.snapshot().view.zoom,
          )) < 0.35
        )
          await page.locator('#zoom-in').click();
        // UI zoom is queued into the engine. Settle it before recording drag
        // metadata/tolerances, retaining these preparation frames separately.
        const cameraSettlement = await page.evaluate(() =>
          window.workflowBenchmark.collect(2, 0),
        );
        const target = await page.evaluate(() =>
          window.workflowBenchmark.dragTarget(),
        );
        const dragStart = await page.evaluate(() =>
          window.workflowBenchmark.state(),
        );
        expect(dragStart.view).toEqual(
          await page.evaluate(() => window.workflowDemo.snapshot().view),
        );
        expect(cameraSettlement.at(-1)?.view).toEqual(dragStart.view);
        const box = (await page.locator('#canvas').boundingBox())!;
        const x = box.x + target.point.x,
          y = box.y + target.point.y;
        await page.evaluate(() => window.workflowBenchmark.begin());
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (const direction of [1, -1]) {
          for (let step = 1; step <= 10; step++) {
            const progress = direction === 1 ? step : 10 - step;
            await page.mouse.move(x + progress * 6, y + progress * 2);
          }
          if (direction === 1)
            await expect
              .poll(async () => {
                const p = await page.evaluate(
                  (id) => window.workflowBenchmark.nodePosition(id),
                  target.id,
                );
                return (p.x - target.x) * dragStart.view.zoom;
              })
              .toBeGreaterThan(30);
        }
        await page.mouse.up();
        await expect
          .poll(() =>
            page.evaluate(() => window.workflowDemo.snapshot().selected),
          )
          .toBe(target.id);
        await expect
          .poll(async () => {
            const p = await page.evaluate(
              (id) => window.workflowBenchmark.nodePosition(id),
              target.id,
            );
            return (
              Math.max(Math.abs(p.x - target.x), Math.abs(p.y - target.y)) *
              dragStart.view.zoom
            );
          })
          .toBeLessThan(5);
        const dragFrames = await page.evaluate(() =>
          window.workflowBenchmark.end(),
        );
        const finalPosition = await page.evaluate(
          (id) => window.workflowBenchmark.nodePosition(id),
          target.id,
        );
        expect(Math.abs(finalPosition.x - target.x)).toBeLessThan(
          5 / dragStart.view.zoom,
        );
        expect(Math.abs(finalPosition.y - target.y)).toBeLessThan(
          5 / dragStart.view.zoom,
        );
        const connectionError = await page.evaluate(
          (id) =>
            Math.max(
              0,
              ...window.workflowDemo
                .connections()
                .filter((c) => c.fromId === id || c.toId === id)
                .map((c) =>
                  Math.max(
                    Math.hypot(
                      c.start.x - c.sourcePort.x,
                      c.start.y - c.sourcePort.y,
                    ),
                    Math.hypot(
                      c.end.x - c.targetPort.x,
                      c.end.y - c.targetPort.y,
                    ),
                  ),
                ),
            ),
          target.id,
        );
        expect(connectionError).toBeLessThan(0.05);
        const drag = {
          imageBatching,
          profiled,
          operation: 'focused-native-pointer-drag',
          cameraSettlement,
          target,
          start: dragStart,
          end: await page.evaluate(() => window.workflowBenchmark.state()),
          finalPosition,
          connectionError,
          frames: dragFrames,
        };
        results.push(drag);
        save();
        console.log(
          JSON.stringify({
            imageBatching,
            profiled,
            operation: drag.operation,
            actualVisible: dragStart.visible,
            frames: dragFrames.length,
            p50: percentile(
              dragFrames.map((f) => f.elapsed),
              0.5,
            ),
            p95: percentile(
              dragFrames.map((f) => f.elapsed),
              0.95,
            ),
            connectionError,
          }),
        );
        expect(
          await page.evaluate(() => window.workflowBenchmark.dispose()),
        ).toEqual({
          run: true,
          createCanvas: true,
          submit: true,
          context: true,
        });
        expect(
          await page.evaluate(() => window.lifecycleProbes.leaks()),
        ).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
});
