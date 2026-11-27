import {
  strokeUploadMode,
  summarizeStrokeUploads,
} from './stroke-upload-tools.mjs';
import { installStrokeUploadProbe } from '../__tests__/browser/fixtures/stroke-upload-probe';
import { cameraPhaseMode, sumCameraPhases } from './camera-phase-tools.mjs';
import { startCameraTimeline } from './camera-timeline';
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import { float32ReplayTarget } from '../__tests__/browser/fixtures/input-replay';
import { sameReplayView } from '../__tests__/browser/fixtures/camera-replay';
import { zoomAt, percentile } from '../examples/workflow-canvas/graph';
import type {} from '../examples/workflow-canvas/benchmark-entry';

/** One native event per completed target, not a continuous-gesture FPS test. */
test('trusted Workflow wheel path preserves the document and GPU ownership', async ({
  browser,
}) => {
  const phaseMode = cameraPhaseMode();
  const uploadMode = strokeUploadMode();
  const count = Number(process.env.WORKFLOW_INPUT_COUNT ?? 2400);
  if (![24, 2400].includes(count))
    throw new Error('Use 24 for correctness or 2400 for the benchmark');
  const length = count === 24 ? 2 : 10;
  const deltas = [
    ...Array(length).fill(-100),
    ...Array(length).fill(100),
  ] as number[];
  const viewport = { width: 1500, height: 980 };
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const capture = {
    schema: 1,
    uploadProbeRestored: undefined as boolean | undefined,
    mode: uploadMode
      ? 'stroke-upload-diagnostic'
      : phaseMode
      ? 'camera-phase-diagnostic'
      : process.env.CAMERA_TIMELINE_DIR
      ? 'camera-timeline-diagnostic'
      : undefined,
    workload: 'workflow-trusted-wheel',
    count,
    deltas,
    viewport,
    dpr: 1,
    browser: browser.version(),
    node: process.version,
    source: {
      head: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
      dirty: !!git('status', '--porcelain'),
    },
    rounds: [] as any[],
    documentSame: false,
    teardown: 'pending',
  };
  const directory = process.env.WORKFLOW_INPUT_OUTPUT_DIR ?? '.test-results';
  mkdirSync(directory, { recursive: true });
  const save = () =>
    writeFileSync(
      join(directory, 'workflow-input.json'),
      JSON.stringify(capture, null, 2) + '\n',
    );
  let timeline: Awaited<ReturnType<typeof startCameraTimeline>>;
  try {
    if (uploadMode) await installStrokeUploadProbe(page);
    await page.addInitScript(installProbes, { resourceStacks: false });
    await page.goto(
      phaseMode ? '/?imageBatching=1&cameraPhases=1' : '/?imageBatching=1',
    );
    await page.waitForFunction(() => window.workflowDemo?.snapshot().ready);
    await page.locator('#scale').selectOption(String(count));
    await page.waitForFunction(
      (n) => {
        const s = window.workflowDemo.snapshot();
        return s.ready && s.renderedNodes === n && s.renderedEdges === n;
      },
      count,
      { timeout: 120000 },
    );
    // `ready` precedes the queued initial selection edit. Do not call that
    // initialization work a document mutation caused by wheel navigation.
    await page.waitForFunction(() =>
      window.workflowBenchmark
        .replayDocument()
        .some((n) => n.id === 'selection' && n.visibility === 'visible'),
    );
    await page.evaluate(() => window.workflowBenchmark.collect(2, 0));
    expect(
      await page.evaluate((mode) => {
        try {
          window.workflowBenchmark.armWheel(mode ? 'ordinary' : 'phases');
          return '';
        } catch (error) {
          return String(error);
        }
      }, phaseMode),
    ).toContain('Wheel phase mode');
    if (phaseMode)
      expect(
        await page.evaluate(() => {
          try {
            window.workflowBenchmark.profile(true);
            return '';
          } catch (error) {
            return String(error);
          }
        }),
      ).toContain('dedicated capture');
    // Positive control: a synthetic event cannot certify native input.
    expect(
      await page.evaluate(async (mode) => {
        const b = window.workflowBenchmark;
        b.armWheel(mode ? 'phases' : 'ordinary');
        const result = b.wheelResult().then(
          () => 'accepted',
          (e) => String(e),
        );
        document
          .querySelector('#canvas')!
          .dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
        return result;
      }, phaseMode),
    ).toContain('Trusted input required');
    expect(
      (await page.evaluate(() => window.workflowBenchmark.checkInputErrors()))
        .errors,
    ).toEqual([]);
    // Positive control: the separated GPU gate must actually detect errors.
    expect(
      await page.evaluate(() => {
        const gl = document
          .querySelector<HTMLCanvasElement>('#canvas')!
          .getContext('webgl2')!;
        gl.enable(0xdead);
        return window.workflowBenchmark.checkInputErrors().errors;
      }),
    ).toEqual([0x0500]);
    expect(
      (await page.evaluate(() => window.workflowBenchmark.checkInputErrors()))
        .errors,
    ).toEqual([]);
    const originalDocument = await page.evaluate(() =>
      window.workflowBenchmark.replayDocument(),
    );
    timeline = await startCameraTimeline(page, 'workflow');
    for (let index = 0; index < 2; index++) {
      await page.locator('#overview').click();
      await page.evaluate(() => window.workflowBenchmark.collect(2, 0));
      const initial = await page.evaluate(() => ({
        demo: window.workflowDemo.snapshot(),
        state: window.workflowBenchmark.state(),
      }));
      expect(initial.state.visible.cards).toBe(count);
      expect(initial.state.visible.edges).toBe(count);
      const box = (await page.locator('#canvas').boundingBox())!;
      const anchor = { x: box.width / 2, y: box.height / 2 };
      await page.mouse.move(box.x + anchor.x, box.y + anchor.y);
      const validationBefore = await page.evaluate(() =>
        window.workflowBenchmark.checkInputErrors(),
      );
      expect(validationBefore.errors).toEqual([]);
      const round = {
        index,
        initial,
        validationBefore,
        steps: [] as any[],
        validationAfter: undefined as unknown,
      };
      capture.rounds.push(round);
      let view = initial.demo.view;
      for (const deltaY of deltas) {
        if (uploadMode)
          await page.evaluate(() => (window as any).strokeUploadProbe.begin());
        const expected = zoomAt(
          view,
          view.zoom * Math.exp(-deltaY * 0.0025),
          anchor.x,
          anchor.y,
        );
        await page.evaluate(
          (mode) =>
            window.workflowBenchmark.armWheel(mode ? 'phases' : 'ordinary'),
          phaseMode,
        );
        await page.mouse.wheel(0, deltaY);
        const row = await page.evaluate(() =>
          window.workflowBenchmark.wheelResult(),
        );
        expect(row.input.isTrusted).toBe(true);
        expect(row.input.deltaMode).toBe(0);
        expect(row.input.deltaY).toBe(deltaY);
        expect(
          sameReplayView(row.requested, float32ReplayTarget(expected)),
        ).toBe(true);
        const last = row.frames.at(-1)!;
        expect(sameReplayView(last.data.uiView, expected)).toBe(true);
        expect(sameReplayView(last.view, float32ReplayTarget(expected))).toBe(
          true,
        );
        expect(row.inputToResultMs).toBeGreaterThanOrEqual(row.inputToFrameMs);
        expect(last.data.state.webglError).toBeUndefined();
        expect(last.data.native.drawcalls).toBeGreaterThan(0);
        if (uploadMode)
          (row as any).strokeUploads = await page.evaluate(() =>
            (window as any).strokeUploadProbe.take(),
          );
        round.steps.push(row);
        view = expected;
        save();
      }
      round.validationAfter = await page.evaluate(() =>
        window.workflowBenchmark.checkInputErrors(),
      );
      expect((round.validationAfter as { errors: number[] }).errors).toEqual(
        [],
      );
    }
    await timeline?.stop(
      capture.rounds.flatMap((r) =>
        r.steps.flatMap((s, i) =>
          s.frames.map((f: any, j: number) => ({
            id: `workflow/${r.index}/${i}/${j}`,
            startedAt: f.startedAt,
            completedAt: f.completedAt,
          })),
        ),
      ),
    );
    expect(
      await page.evaluate(() => window.workflowBenchmark.replayDocument()),
    ).toEqual(originalDocument);
    capture.documentSame = true;
    if (uploadMode)
      capture.uploadProbeRestored = await page.evaluate(() =>
        (window as any).strokeUploadProbe.dispose(),
      );
    // Pending input must reject on real example teardown, without leaking listeners.
    expect(
      await page.evaluate(async (mode) => {
        const b = window.workflowBenchmark;
        b.armWheel(mode ? 'phases' : 'ordinary');
        const pending = b.wheelResult().then(
          () => 'accepted',
          (e) => String(e),
        );
        const restored = await b.dispose();
        return { restored, pending: await pending };
      }, phaseMode),
    ).toEqual({
      restored: { run: true, createCanvas: true, submit: true, context: true },
      pending: 'Error: Input replay disposed',
    });
    expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
      [],
    );
    expect(errors).toEqual([]);
    capture.teardown = 'passed';
    save();
    for (const round of capture.rounds) {
      const frames = round.steps.flatMap((s) => s.frames);
      const summary = (values: number[]) => ({
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        total: values.reduce((a, b) => a + b, 0),
      });
      console.log(
        JSON.stringify({
          mode: capture.mode,
          ...(phaseMode ? { phaseSummary: sumCameraPhases(frames) } : {}),
          round: round.index,
          count,
          events: round.steps.length,
          frames: frames.length,
          cpuMs: summary(frames.map((f) => f.elapsed)),
          matchedCpuMs: summary(
            round.steps.map((s) => s.frames.at(-1)!.elapsed),
          ),
          observationMs: summary(frames.map((f) => f.observationMs)),
          inputToFrameMs: summary(round.steps.map((s) => s.inputToFrameMs)),
          inputToResultMs: summary(round.steps.map((s) => s.inputToResultMs)),
          drawcalls: frames.map((f) => f.data.native.drawcalls),
          indices: frames.map((f) => f.data.native.indices),
          arrayVertices: frames.map((f) => f.data.native.arrayVertices),
          visibleCards: frames.map((f) => f.data.state.visible.cards),
          visibleEdges: frames.map((f) => f.data.state.visible.edges),
          bufferBytes: frames.map((f) => f.data.state.allocatedBufferBytes),
          validationAfter: round.validationAfter,
        }),
      );
    }
    if (uploadMode)
      console.log(JSON.stringify(summarizeStrokeUploads(capture)));
  } finally {
    await timeline?.abort();
    await page.close();
  }
});
