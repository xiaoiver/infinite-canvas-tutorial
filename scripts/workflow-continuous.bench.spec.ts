import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installProbes } from '../__tests__/browser/fixtures/probes';
import { summarizeWorkflowContinuous } from './workflow-continuous-tools.mjs';
import type {} from '../examples/workflow-canvas/benchmark-entry';

test('continuous trusted wheel stream reaches the final Workflow camera without per-input frame waits', async ({
  browser,
}) => {
  for (const k of [
    'CAMERA_PHASES',
    'CAMERA_TIMELINE_DIR',
    'STROKE_UPLOAD_DIAGNOSTIC',
    'STROKE_TEXTURE_BENCH',
  ])
    if (process.env[k])
      throw new Error('Continuous input requires its own unprofiled capture');
  const count = Number(process.env.WORKFLOW_INPUT_COUNT ?? 2400);
  if (![24, 2400].includes(count))
    throw new Error('Use 24 for correctness or 2400 for measurement');
  const commandCount = count === 24 ? 8 : 40,
    cadenceMs = 16;
  const git = (...args: string[]) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const capture = {
    schema: 1,
    mode: 'continuous-input',
    workload: 'workflow-continuous-wheel',
    count,
    commandCount,
    cadenceMs,
    viewport: { width: 1500, height: 980 },
    dpr: 1,
    browser: browser.version(),
    node: process.version,
    source: {
      head: git('rev-parse', 'HEAD'),
      tree: git('rev-parse', 'HEAD^{tree}'),
      dirty: !!git('status', '--porcelain'),
    },
    gestures: [] as any[],
    documentSame: false,
    teardown: 'pending',
  };
  const directory =
    process.env.WORKFLOW_CONTINUOUS_OUTPUT_DIR ?? '.test-results';
  mkdirSync(directory, { recursive: true });
  const save = () =>
    writeFileSync(
      join(directory, 'workflow-continuous.json'),
      JSON.stringify(capture, null, 2) + '\n',
    );
  const page = await browser.newPage({
    viewport: capture.viewport,
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.addInitScript(installProbes, { resourceStacks: false });
    await page.goto('/?imageBatching=1');
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
    await page.waitForFunction(() =>
      window.workflowBenchmark
        .replayDocument()
        .some((n) => n.id === 'selection' && n.visibility === 'visible'),
    );
    await page.evaluate(() => window.workflowBenchmark.collect(2, 0));
    // Positive control: this observer cannot certify synthetic DOM dispatch.
    await page.evaluate(() => {
      window.workflowBenchmark.startContinuousWheel();
      document
        .querySelector('#canvas')!
        .dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }));
    });
    expect(
      (
        await page.evaluate(() =>
          window.workflowBenchmark.continuousWheelStatus(),
        )
      ).errors,
    ).toEqual(['Trusted input required']);
    await page.evaluate(() => window.workflowBenchmark.cancelContinuousWheel());
    const documentBefore = await page.evaluate(() =>
      window.workflowBenchmark.replayDocument(),
    );
    for (const round of [0, 1]) {
      await page.locator('#overview').click();
      await page.evaluate(() => window.workflowBenchmark.collect(2, 0));
      for (const direction of ['in', 'out'] as const) {
        const deltaY = direction === 'in' ? -20 : 20;
        const box = (await page.locator('#canvas').boundingBox())!;
        const anchor = {
          clientX: box.x + box.width / 2,
          clientY: box.y + box.height / 2,
          viewportX: box.width / 2,
          viewportY: box.height / 2,
        };
        await page.mouse.move(anchor.clientX, anchor.clientY);
        const before = await page.evaluate(() =>
          window.workflowBenchmark.checkInputErrors(),
        );
        expect(before.errors).toEqual([]);
        const initial = await page.evaluate(() =>
          window.workflowBenchmark.startContinuousWheel(),
        );
        if (direction === 'in')
          expect(initial.state.visible).toMatchObject({
            cards: count,
            edges: count,
          });
        const gesture = {
          round,
          direction,
          deltaY,
          commandCount,
          cadenceMs,
          anchor,
          initial,
          commands: [] as {
            sequence: number;
            scheduledAfterMs: number;
            dispatchedAfterMs: number;
            acknowledgedAfterMs?: number;
          }[],
          stream: undefined as any,
          validationBefore: before,
          validationAfter: undefined as any,
        };
        capture.gestures.push(gesture);
        save();
        const started = performance.now(),
          pending: Promise<void>[] = [];
        for (let i = 0; i < commandCount; i++) {
          const scheduledAfterMs = i * cadenceMs,
            wait = started + scheduledAfterMs - performance.now();
          if (wait > 0)
            await new Promise((resolve) => setTimeout(resolve, wait));
          const command = {
            sequence: i + 1,
            scheduledAfterMs,
            dispatchedAfterMs: performance.now() - started,
          } as (typeof gesture.commands)[number];
          gesture.commands.push(command);
          // Enqueue on the host clock; do not wait for a target frame or an earlier
          // command's acknowledgement. Browser coalescing is measured, not assumed.
          pending.push(
            page.mouse.wheel(0, deltaY).then(() => {
              command.acknowledgedAfterMs = performance.now() - started;
            }),
          );
        }
        await Promise.all(pending);
        await page.waitForFunction(
          (expected) => {
            const s = window.workflowBenchmark.continuousWheelStatus();
            if (s.errors.length) throw new Error(s.errors.join('; '));
            return (
              Math.abs(s.deltaY - expected) < 1e-6 && s.events > 0 && s.ready
            );
          },
          commandCount * deltaY,
          { timeout: 120000 },
        );
        gesture.stream = await page.evaluate(() =>
          window.workflowBenchmark.finishContinuousWheel(),
        );
        expect(
          gesture.stream.events.reduce(
            (sum: number, e: any) => sum + e.input.deltaY,
            0,
          ),
        ).toBe(commandCount * deltaY);
        gesture.validationAfter = await page.evaluate(() =>
          window.workflowBenchmark.checkInputErrors(),
        );
        expect(gesture.validationAfter.errors).toEqual([]);
        save();
      }
    }
    expect(
      await page.evaluate(() => window.workflowBenchmark.replayDocument()),
    ).toEqual(documentBefore);
    capture.documentSame = true;
    expect(
      await page.evaluate(() => window.workflowBenchmark.dispose()),
    ).toEqual({ run: true, createCanvas: true, submit: true, context: true });
    expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual(
      [],
    );
    expect(errors).toEqual([]);
    capture.teardown = 'passed';
    save();
    console.log(JSON.stringify(summarizeWorkflowContinuous(capture)));
  } finally {
    save();
    await page.close();
  }
});
