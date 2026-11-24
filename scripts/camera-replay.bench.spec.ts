import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import {
  CAMERA_REPLAY_VERSION,
  fixedCameraTrace,
  replayStrokeNodes,
  sameReplayView,
} from '../__tests__/browser/fixtures/camera-replay';
import { cameraTraceHash, summarizeReplay } from './camera-replay-tools.mjs';
import type {} from '../__tests__/browser/fixtures/core-path-instances';
import type { PolylineLODHarness } from '../__tests__/browser/fixtures/polyline-lod';
declare global {
  interface Window {
    polylineLOD: PolylineLODHarness;
  }
}
test('fixed Core/ECS 2400-stroke camera trace', async ({ browser }) => {
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const trace = fixedCameraTrace('strokes'),
    viewport = { width: 1000, height: 760, dpr: 1 };
  const capture = {
    schema: CAMERA_REPLAY_VERSION,
    workload: 'strokes',
    trace,
    viewport,
    traceHash: cameraTraceHash('strokes', trace, viewport),
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
      join(directory, 'camera-replay-strokes.json'),
      JSON.stringify(capture, null, 2) + '\n',
    );
  for (const backend of ['core', 'ecs'] as const) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.addInitScript(installProbes, { resourceStacks: false });
      await page.goto(
        backend === 'core' ? '/core-path-instances.html' : '/polyline-lod.html',
      );
      await expect(page.locator('#status')).toHaveText('Ready');
      await page.evaluate(
        async ({ backend, nodes }) => {
          if (backend === 'core') {
            window.corePathInstances.strokes(nodes.length);
            window.corePathInstances.enable(true);
            window.corePathInstances.camera(0, 0.13);
          } else {
            await window.polylineLOD.document(nodes);
            await window.polylineLOD.pathInstancing(true);
            await window.polylineLOD.zoom(0.13);
          }
        },
        { backend, nodes: replayStrokeNodes(2400) },
      );
      const document = await page.evaluate(
        (b) =>
          b === 'core'
            ? window.corePathInstances.replayDocument()
            : window.polylineLOD.replayDocument(),
        backend,
      );
      const result = {
        backend,
        mode: 'scoped',
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
            async ({ backend, view }) =>
              backend === 'core'
                ? window.corePathInstances.replayCamera(view)
                : await window.polylineLOD.replayCamera(view),
            { backend, view },
          );
          expect(sameReplayView(step.frames.at(-1)!.view, view)).toBe(true);
          if (id === 'offscreen')
            expect(step.frames.at(-1)!.data.visible).toBe(0);
          if (id === 'overview' || id === 'reentry')
            expect(step.frames.at(-1)!.data.visible).toBe(2400);
          if (id.endsWith('idle'))
            expect(step.frames.at(-1)!.data.native.drawcalls).toBe(0);
          round.steps.push({ id, ...step });
          save();
        }
      }
      expect(
        await page.evaluate(
          (b) =>
            b === 'core'
              ? window.corePathInstances.replayDocument()
              : window.polylineLOD.replayDocument(),
          backend,
        ),
      ).toEqual(document);
      result.documentSame = true;
      const baseline = await page.evaluate(
        async (b) =>
          b === 'core'
            ? window.corePathInstances.destroy()
            : await window.polylineLOD.destroy(),
        backend,
      );
      if (backend === 'core')
        expect(
          await page.evaluate(() => window.lifecycleProbes.resources()),
        ).toEqual(baseline);
      else
        expect(
          await page.evaluate(() => window.lifecycleProbes.leaks()),
        ).toEqual([]);
      expect(errors).toEqual([]);
      result.teardown = 'passed';
      save();
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify(summarizeReplay(capture)));
});
