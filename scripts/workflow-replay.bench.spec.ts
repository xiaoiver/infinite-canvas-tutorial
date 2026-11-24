import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import {
  CAMERA_REPLAY_VERSION,
  fixedCameraTrace,
  sameReplayView,
} from '../__tests__/browser/fixtures/camera-replay';
import { cameraTraceHash, summarizeReplay } from './camera-replay-tools.mjs';
import type {} from '../examples/workflow-canvas/benchmark-entry';
import type {} from '../examples/workflow-canvas/main';
test('fixed real Workflow camera trace at 2400 cards and edges', async ({
  browser,
}) => {
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const trace = fixedCameraTrace('workflow'),
    viewport = { width: 1500, height: 980, dpr: 1 };
  const capture = {
    schema: CAMERA_REPLAY_VERSION,
    workload: 'workflow',
    trace,
    viewport,
    traceHash: cameraTraceHash('workflow', trace, viewport),
    browser: browser.version(),
    node: process.version,
    source: {
      head: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
      dirty: !!git('status', '--porcelain'),
    },
    results: [] as any[],
  };
  const directory = process.env.CAMERA_REPLAY_OUTPUT_DIR ?? '.test-results';
  mkdirSync(directory, { recursive: true });
  const save = () =>
    writeFileSync(
      join(directory, 'camera-replay-workflow.json'),
      JSON.stringify(capture, null, 2) + '\n',
    );
  for (const profiled of [false, true]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addInitScript(installProbes, { resourceStacks: false });
      await page.goto('/?imageBatching=1');
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
      await page.evaluate((p) => window.workflowBenchmark.profile(p), profiled);
      const legacyBefore = await page.evaluate(() =>
        window.workflowBenchmark.collect(2, 0),
      );
      const initial = await page.evaluate(() =>
        window.workflowBenchmark.state(),
      );
      const document = await page.evaluate(() =>
        window.workflowBenchmark.replayDocument(),
      );
      const result = {
        backend: 'ecs-workflow',
        mode: profiled ? 'profiled' : 'ordinary',
        initial,
        legacyBefore,
        rounds: [] as any[],
        documentSame: false,
        teardown: 'pending',
      };
      capture.results.push(result);
      for (let index = 0; index < 2; index++) {
        const round = { index, steps: [] as any[] };
        result.rounds.push(round);
        for (const { id, ...view } of trace) {
          const step = await page.evaluate(
            (view) => window.workflowBenchmark.replayCamera(view),
            view,
          );
          const frame = step.frames.at(-1)!;
          expect(sameReplayView(frame.view, view)).toBe(true);
          if (id === 'offscreen') expect(frame.data.visibleIds).toHaveLength(0);
          if (id === 'overview' || id === 'reentry') {
            expect(frame.data.state.visible.cards).toBe(2400);
            expect(frame.data.state.visible.edges).toBe(2400);
          }
          if (id.endsWith('idle')) expect(frame.data.native.drawcalls).toBe(0);
          expect(frame.data.state.webglError).toBe(0);
          round.steps.push({ id, ...step });
          save();
        }
      }
      expect(
        await page.evaluate(() => window.workflowBenchmark.replayDocument()),
      ).toEqual(document);
      const final = await page.evaluate(() => window.workflowBenchmark.state());
      expect(final.count).toBe(initial.count);
      expect(final.documentVersions).toEqual(initial.documentVersions);
      result.documentSame = true;
      const legacyAfter = await page.evaluate(() =>
        window.workflowBenchmark.collect(2, 0),
      );
      expect(legacyAfter.every((f) => f.native.drawcalls === 0)).toBe(true);
      expect(
        await page.evaluate(() => window.workflowBenchmark.dispose()),
      ).toEqual({ run: true, createCanvas: true, submit: true, context: true });
      expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
        [],
      );
      expect(errors).toEqual([]);
      result.teardown = 'passed';
      save();
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify(summarizeReplay(capture)));
});
