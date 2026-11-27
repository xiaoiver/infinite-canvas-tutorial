import assert from 'node:assert/strict';
import {
  analyzeCameraTrace,
  covered,
  overlap,
} from './camera-timeline-tools.mjs';
import { summarizeWorkflowContinuousTrace } from './workflow-continuous-tools.mjs';
export const CONTINUOUS_TRACE_CATEGORIES =
  'toplevel,devtools.timeline,v8,blink.user_timing,cc,gpu,viz,input,latencyInfo,benchmark';
export function continuousTimelineMode(env = process.env) {
  for (const key of [
    'CAMERA_PHASES',
    'STROKE_UPLOAD_DIAGNOSTIC',
    'STROKE_TEXTURE_BENCH',
  ])
    assert(!env[key], 'Continuous input requires a separate capture');
  if (!env.CAMERA_TIMELINE_DIR) return false;
  assert.equal(
    env.CAMERA_TIMELINE_MODE,
    'trace',
    'Continuous timeline requires explicit trace-only mode',
  );
  return true;
}
/** Partition receipt-to-final-completion spans; earlier idle frames remain outside. */
export function continuousTimelineWindows(capture) {
  const windows = [];
  let previousEnd = -Infinity;
  for (const g of capture.gestures) {
    assert(
      g.stream?.events.length && g.stream?.frames.length,
      'Incomplete gesture',
    );
    const gesture = `${g.round}/${g.direction}`,
      first = g.stream.events[0].receivedAt;
    assert(
      Number.isFinite(first) && first >= previousEnd,
      'Gesture spans overlap',
    );
    let cursor = first,
      frameEnd = -Infinity;
    for (const [index, f] of g.stream.frames.entries()) {
      assert(
        Number.isFinite(f.startedAt) &&
          Number.isFinite(f.completedAt) &&
          f.completedAt >= f.startedAt &&
          f.startedAt >= frameEnd,
        'Invalid/overlapping frame windows',
      );
      frameEnd = f.completedAt;
      if (f.completedAt <= first) continue;
      if (f.startedAt > cursor)
        windows.push({
          id: `${gesture}/gap/${index}`,
          gesture,
          kind: 'gap',
          startedAt: cursor,
          completedAt: f.startedAt,
        });
      const startedAt = Math.max(cursor, f.startedAt);
      if (f.completedAt > startedAt)
        windows.push({
          id: `${gesture}/engine/${index}`,
          gesture,
          kind: 'engine',
          startedAt,
          completedAt: f.completedAt,
        });
      cursor = f.completedAt;
    }
    previousEnd = cursor;
  }
  assert(windows.length > 0, 'No continuous windows');
  return windows;
}
/** Trace durations/coverage only: threads are not CPU or GPU execution-time counters. */
export function analyzeContinuousTimeline(trace, capture) {
  const workload = summarizeWorkflowContinuousTrace(capture);
  assert.equal(trace.scope, 'continuous-input');
  assert.equal(
    trace.categories,
    CONTINUOUS_TRACE_CATEGORIES,
    'Continuous trace category scope differs',
  );
  assert.deepEqual(
    trace.source,
    capture.source,
    'Trace/workload source differs',
  );
  assert.equal(trace.browser, capture.browser);
  assert.equal(trace.node, capture.node);
  const windows = continuousTimelineWindows(capture);
  assert.deepEqual(
    trace.windows,
    windows,
    'Trace windows do not match completed workload',
  );
  const base = analyzeCameraTrace(trace),
    { offsetMs, pid, tid, toleranceMs } = base.clock;
  const interval = (e) => [e.ts / 1000, (e.ts + e.dur) / 1000];
  const metadata = trace.traceEvents.filter((e) => e.ph === 'M');
  const processNames = new Map(
    metadata
      .filter((e) => e.name === 'process_name')
      .map((e) => [e.pid, e.args?.name]),
  );
  const threadNames = new Map(
    metadata
      .filter((e) => e.name === 'thread_name')
      .map((e) => [`${e.pid}/${e.tid}`, e.args?.name]),
  );
  const complete = trace.traceEvents.filter(
    (e) =>
      e.ph === 'X' &&
      Number.isFinite(e.ts) &&
      Number.isFinite(e.dur) &&
      e.dur >= 0,
  );
  const threads = new Map();
  for (const e of complete) {
    const key = `${e.pid}/${e.tid}`;
    if (!threads.has(key)) threads.set(key, []);
    threads.get(key).push(e);
  }
  const wheelDispatch = complete.filter(
    (e) =>
      e.pid === pid &&
      e.tid === tid &&
      e.name === 'EventDispatch' &&
      e.args?.data?.type === 'wheel',
  );
  const marks = [];
  for (const g of capture.gestures)
    for (const e of g.stream.events) {
      const m = e.traceMark,
        found = trace.traceEvents.filter((t) => t.name === m.name);
      assert.equal(
        found.length,
        1,
        'Input mark missing or duplicated in trace',
      );
      const t = found[0];
      assert.equal(t.pid, pid, 'Input mark renderer differs');
      assert.equal(t.tid, tid, 'Input mark main thread differs');
      assert(
        Number.isFinite(t.ts) &&
          Math.abs(t.ts / 1000 - offsetMs - m.pageMs) <= toleranceMs,
        'Input mark clock differs',
      );
      assert(
        m.pageMs <= g.stream.frames.at(-1).completedAt,
        'Input mark follows final frame',
      );
      const received = e.receivedAt + offsetMs;
      const dispatches = wheelDispatch.filter((d) => {
        const [a, b] = interval(d);
        return received >= a - toleranceMs && received <= b + toleranceMs;
      });
      marks.push({
        gesture: `${g.round}/${g.direction}`,
        sequence: e.sequence,
        name: m.name,
        receivedAt: e.receivedAt,
        markDelayMs: m.pageMs - e.receivedAt,
        wheelDispatchCandidates: dispatches.length,
      });
    }
  const parts = [];
  for (const g of capture.gestures)
    for (const kind of ['engine', 'gap']) {
      const gesture = `${g.round}/${g.direction}`,
        selected = base.windows.filter(
          (w) => w.gesture === gesture && w.kind === kind,
        );
      const ranges = selected.map((w) => [
        w.startedAt + offsetMs,
        w.completedAt + offsetMs,
      ]);
      const byThread = [];
      for (const [key, events] of threads) {
        const unionMs = ranges.reduce(
          (n, r) => n + covered(events.map(interval), r),
          0,
        );
        if (!unionMs) continue;
        const inclusive = new Map();
        let eventCount = 0;
        for (const e of events) {
          const ms = ranges.reduce((n, r) => n + overlap(interval(e), r), 0);
          if (ms) {
            eventCount++;
            inclusive.set(e.name, (inclusive.get(e.name) ?? 0) + ms);
          }
        }
        const [eventPid, eventTid] = key.split('/').map(Number);
        byThread.push({
          pid: eventPid,
          tid: eventTid,
          process: processNames.get(eventPid) ?? 'unknown',
          thread: threadNames.get(key) ?? 'unknown',
          recordedEventUnionMs: unionMs,
          eventCount,
          inclusiveTop: [...inclusive].sort((a, b) => b[1] - a[1]).slice(0, 15),
        });
      }
      parts.push({
        gesture,
        kind,
        windows: selected.length,
        elapsedMs: selected.reduce((n, w) => n + w.elapsedMs, 0),
        mainTaskCoveredMs: selected.reduce((n, w) => n + w.taskCoveredMs, 0),
        outsideMainTasksMs: selected.reduce(
          (n, w) => n + w.outsideRecordedTasksMs,
          0,
        ),
        mainGCLabelUnionMs: selected.reduce((n, w) => n + w.gcCoveredMs, 0),
        byThread: byThread
          .sort((a, b) => b.recordedEventUnionMs - a.recordedEventUnionMs)
          .slice(0, 30),
      });
    }
  return {
    mode: 'continuous-input-timeline',
    captureKind: 'trace-only',
    source: capture.source,
    browser: capture.browser,
    node: capture.node,
    clock: base.clock,
    marks: {
      total: marks.length,
      uniqueWheelDispatch: marks.filter((m) => m.wheelDispatchCandidates === 1)
        .length,
      unmatched: marks.filter((m) => m.wheelDispatchCandidates === 0).length,
      ambiguous: marks.filter((m) => m.wheelDispatchCandidates > 1).length,
      maxReceiptToMarkMs: Math.max(...marks.map((m) => m.markDelayMs)),
    },
    workload,
    parts,
    longestGaps: base.windows
      .filter((w) => w.kind === 'gap')
      .sort((a, b) => b.elapsedMs - a.elapsedMs)
      .slice(0, 12),
    inputMarks: marks,
  };
}
