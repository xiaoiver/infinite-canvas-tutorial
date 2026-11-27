import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  analyzeCameraTimeline,
  analyzeCameraTrace,
} from './camera-timeline-tools.mjs';

type Window = { id: string; startedAt: number; completedAt: number };
/** Opt-in diagnostic: never part of ordinary elapsed-time comparisons. */
export async function startCameraTimeline(
  page: Page,
  name: string,
  scope: 'engine' | 'continuous-input' = 'engine',
) {
  const directory = process.env.CAMERA_TIMELINE_DIR;
  if (!directory) return;
  const kind = process.env.CAMERA_TIMELINE_MODE ?? 'profile';
  if (kind !== 'profile' && kind !== 'trace')
    throw new Error('CAMERA_TIMELINE_MODE must be profile or trace');
  const traceOnly = kind === 'trace';
  if (scope !== 'engine' && scope !== 'continuous-input')
    throw new Error('Unknown timeline scope');
  if (scope === 'continuous-input' && !traceOnly)
    throw new Error('Continuous timeline requires trace-only mode');
  const categories =
    scope === 'continuous-input'
      ? 'toplevel,devtools.timeline,v8,blink.user_timing,cc,gpu,viz,input,latencyInfo,benchmark'
      : 'toplevel,devtools.timeline,v8,blink.user_timing';
  const session = await page.context().newCDPSession(page);
  const traceEvents: any[] = [];
  session.on('Tracing.dataCollected', ({ value }) =>
    traceEvents.push(...value),
  );
  let tracing = false,
    profiling = false,
    detached = false;
  const cleanup = async () => {
    if (detached) return;
    detached = true;
    if (profiling) await session.send('Profiler.stop').catch(() => {});
    if (tracing) await session.send('Tracing.end').catch(() => {});
    await session.detach();
  };
  const save = (suffix: string, value: unknown) => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, `${name}.${suffix}.json`),
      JSON.stringify(value) + '\n',
    );
  };
  const anchor = (suffix: string) =>
    page.evaluate((name) => {
      const mark = performance.mark(name);
      return { name, pageMs: mark.startTime };
    }, `camera-timeline-${name}-${suffix}`);
  try {
    await session.send('Performance.enable');
    if (!traceOnly) {
      await session.send('Profiler.enable');
      await session.send('Profiler.setSamplingInterval', { interval: 1000 });
    }
    await session.send('Tracing.start', {
      categories,
      options: 'record-as-much-as-possible',
      transferMode: 'ReportEvents',
    });
    tracing = true;
    if (!traceOnly) {
      await session.send('Profiler.start');
      profiling = true;
    }
    const first = await anchor('start');
    const beforeMs = await page.evaluate(() => performance.now());
    const metrics = await session.send('Performance.getMetrics');
    const afterMs = await page.evaluate(() => performance.now());
    const timestampMs =
      metrics.metrics.find((m) => m.name === 'Timestamp')!.value * 1000;
    return {
      abort: cleanup,
      async stop(windows: Window[]) {
        try {
          const last = await anchor('end');
          let profile;
          if (profiling) {
            ({ profile } = await session.send('Profiler.stop'));
            profiling = false;
          }
          const complete = new Promise<any>((resolve) =>
            session.once('Tracing.tracingComplete', resolve),
          );
          await session.send('Tracing.end');
          const completion = await complete;
          tracing = false;
          const git = (...args: string[]) =>
            execFileSync('git', args, { encoding: 'utf8' }).trim();
          const capture = {
            source: {
              head: git('rev-parse', 'HEAD'),
              tree: git('rev-parse', 'HEAD^{tree}'),
              dirty: !!git('status', '--porcelain'),
            },
            browser: page.context().browser()?.version(),
            node: process.version,
            schema: 1,
            mode: 'camera-timeline-diagnostic',
            captureKind: traceOnly ? 'trace-only' : 'profile',
            ...(scope === 'continuous-input' ? { scope, categories } : {}),
            anchors: [first, last],
            clockBracket: { beforeMs, afterMs, timestampMs },
            ...(traceOnly ? {} : { profile }),
            traceEvents,
            windows,
            dataLossOccurred: completion.dataLossOccurred,
          };
          save('raw', capture);
          if (completion.dataLossOccurred)
            throw new Error('Timeline trace lost events');
          const report = traceOnly
            ? analyzeCameraTrace(capture)
            : analyzeCameraTimeline(capture);
          save('summary', report);
          return report;
        } finally {
          await cleanup();
        }
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
