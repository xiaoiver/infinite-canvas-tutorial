import test from 'node:test';
import assert from 'node:assert/strict';
import { makeContinuousGesture } from './helpers/continuous-fixture.mjs';
import {
  continuousTimelineMode,
  continuousTimelineWindows,
  analyzeContinuousTimeline,
  CONTINUOUS_TRACE_CATEGORIES,
} from '../../scripts/continuous-timeline-tools.mjs';
import { summarizeWorkflowContinuous } from '../../scripts/workflow-continuous-tools.mjs';
const capture = () => {
  const c = {
    schema: 1,
    mode: 'continuous-input-timeline',
    workload: 'workflow-continuous-wheel',
    count: 24,
    commandCount: 8,
    cadenceMs: 16,
    browser: 'test',
    node: 'test',
    source: { head: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false },
    documentSame: true,
    teardown: 'passed',
    timeline: {
      captureKind: 'trace-only',
      scope: 'continuous-input',
      stopped: true,
      marksCleared: true,
    },
    gestures: [],
  };
  for (const [i, [round, direction]] of [
    [0, [0, 'in']],
    [1, [0, 'out']],
    [2, [1, 'in']],
    [3, [1, 'out']],
  ]) {
    const g = {
      ...makeContinuousGesture(direction === 'in' ? -20 : 20, 8),
      round,
      direction,
    };
    for (const e of g.stream.events) {
      e.receivedAt += i * 120;
      e.traceMark = {
        name: `wheel-${i}-${e.sequence}`,
        pageMs: e.receivedAt + 0.1,
      };
    }
    for (const f of g.stream.frames)
      for (const k of ['startedAt', 'completedAt', 'observedAt'])
        f[k] += i * 120;
    c.gestures.push(g);
  }
  const events = [
    { name: 'start', ph: 'I', pid: 1, tid: 2, ts: 1000000 },
    { name: 'end', ph: 'I', pid: 1, tid: 2, ts: 1500000 },
    { name: 'RunTask', ph: 'X', pid: 1, tid: 2, ts: 1000000, dur: 500000 },
    { name: 'process_name', ph: 'M', pid: 3, args: { name: 'GPU Process' } },
    {
      name: 'thread_name',
      ph: 'M',
      pid: 3,
      tid: 4,
      args: { name: 'GPU service' },
    },
    { name: 'GPU command', ph: 'X', pid: 3, tid: 4, ts: 1020000, dur: 10000 },
    { name: 'GPU command', ph: 'X', pid: 3, tid: 4, ts: 1022000, dur: 6000 },
  ];
  for (const g of c.gestures)
    for (const e of g.stream.events) {
      events.push(
        {
          name: e.traceMark.name,
          ph: 'I',
          pid: 1,
          tid: 2,
          ts: (e.traceMark.pageMs + 1000) * 1000,
        },
        {
          name: 'EventDispatch',
          ph: 'X',
          pid: 1,
          tid: 2,
          ts: (e.receivedAt + 999.8) * 1000,
          dur: 500,
          args: { data: { type: 'wheel' } },
        },
      );
    }
  const trace = {
    schema: 1,
    mode: 'camera-timeline-diagnostic',
    captureKind: 'trace-only',
    scope: 'continuous-input',
    categories: CONTINUOUS_TRACE_CATEGORIES,
    source: { ...c.source },
    browser: c.browser,
    node: c.node,
    dataLossOccurred: false,
    anchors: [
      { name: 'start', pageMs: 0 },
      { name: 'end', pageMs: 500 },
    ],
    clockBracket: { beforeMs: 4, afterMs: 6, timestampMs: 1005 },
    traceEvents: events,
    windows: continuousTimelineWindows(c),
  };
  return { c, trace };
};
test('continuous timeline is explicit, separate and refuses mixed/profile modes', () => {
  assert.equal(continuousTimelineMode({}), false);
  assert.equal(
    continuousTimelineMode({ CAMERA_TIMELINE_MODE: 'trace' }),
    false,
  );
  assert.equal(
    continuousTimelineMode({
      CAMERA_TIMELINE_DIR: 'trace',
      CAMERA_TIMELINE_MODE: 'trace',
    }),
    true,
  );
  for (const env of [
    { CAMERA_TIMELINE_DIR: 'trace' },
    { CAMERA_TIMELINE_DIR: 'trace', CAMERA_TIMELINE_MODE: 'profile' },
    { CAMERA_PHASES: '1' },
    { STROKE_TEXTURE_BENCH: '0' },
  ])
    assert.throws(() => continuousTimelineMode(env));
  const { c } = capture();
  assert.throws(() => summarizeWorkflowContinuous(c));
  c.mode = 'continuous-input';
  assert.throws(() => summarizeWorkflowContinuous(c));
  delete c.timeline;
  assert.throws(() => summarizeWorkflowContinuous(c), /marks/);
});
test('engine/gap windows partition actual receipt spans and retain per-thread unions', () => {
  const { c, trace } = capture(),
    r = analyzeContinuousTimeline(trace, c);
  assert.equal(r.marks.total, 32);
  assert.equal(r.marks.uniqueWheelDispatch, 32);
  assert.equal(r.parts.length, 8);
  for (const g of c.gestures) {
    const selected = r.parts.filter(
      (p) => p.gesture === `${g.round}/${g.direction}`,
    );
    assert.equal(
      selected.reduce((n, p) => n + p.elapsedMs, 0),
      g.stream.frames.at(-1).completedAt - g.stream.events[0].receivedAt,
    );
  }
  const gpu = r.parts
    .filter((p) => p.gesture === '0/in')
    .flatMap((p) => p.byThread)
    .filter((t) => t.pid === 3);
  assert.equal(
    gpu.reduce((n, t) => n + t.recordedEventUnionMs, 0),
    10,
  ); // Nested durations must not sum to 16.
  assert(gpu.every((t) => t.thread === 'GPU service'));
});
test('pre-receipt idle executions do not enlarge the analyzed interaction span', () => {
  const windows = continuousTimelineWindows({
    gestures: [
      {
        round: 0,
        direction: 'in',
        stream: {
          events: [{ receivedAt: 10 }],
          frames: [
            { startedAt: 0, completedAt: 5 },
            { startedAt: 8, completedAt: 15 },
            { startedAt: 20, completedAt: 30 },
          ],
        },
      },
    ],
  });
  assert.deepEqual(
    windows.map(({ kind, startedAt, completedAt }) => [kind, startedAt, completedAt]),
    [['engine', 10, 15], ['gap', 15, 20], ['engine', 20, 30]],
  );
});
test('outside-task time stays unassigned even with concurrent GPU-thread events', () => {
  const { c, trace } = capture();
  trace.traceEvents.find((e) => e.name === 'RunTask').dur = 5000;
  const r = analyzeContinuousTimeline(trace, c);
  assert(
    r.parts.every(
      (p) => p.mainTaskCoveredMs === 0 && p.outsideMainTasksMs === p.elapsedMs,
    ),
  );
  assert(!('gpuWaitMs' in r));
});
test('rejects trace loss, clock/source/scope/mark mismatch and fabricated windows', () => {
  for (const mutate of [
    (c, t) => (t.dataLossOccurred = true),
    (c, t) => (t.profile = undefined),
    (c, t) => (t.scope = 'engine'),
    (c, t) => (t.categories += ',disabled-by-default-devtools.screenshot'),
    (c, t) => (t.source.head = 'c'.repeat(40)),
    (c, t) => (t.traceEvents.find((e) => e.name === 'end').ts += 1000),
    (c, t) => t.windows[0].completedAt++,
    (c) => (c.gestures[1].stream.frames[0].startedAt = 0),
    (c, t) =>
      t.traceEvents.push({
        ...t.traceEvents.find((e) => e.name === 'wheel-0-1'),
      }),
    (c, t) => (t.traceEvents.find((e) => e.name === 'wheel-0-1').tid = 4),
    (c, t) => (t.traceEvents.find((e) => e.name === 'wheel-0-1').ts += 1000),
    (c) => (c.timeline.marksCleared = false),
  ]) {
    const { c, trace } = capture();
    mutate(c, trace);
    assert.throws(() => analyzeContinuousTimeline(trace, c));
  }
});
test('does not invent EventDispatch attribution when the category lacks dispatch records', () => {
  const { c, trace } = capture();
  trace.traceEvents = trace.traceEvents.filter(
    (e) => e.name !== 'EventDispatch',
  );
  const r = analyzeContinuousTimeline(trace, c);
  assert.equal(r.marks.unmatched, 32);
  assert.equal(r.marks.uniqueWheelDispatch, 0);
});
