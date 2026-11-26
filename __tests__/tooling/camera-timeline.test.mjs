import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCameraTimeline,
  analyzeCameraTrace,
  covered,
  overlap,
} from '../../scripts/camera-timeline-tools.mjs';
import { compareReplays } from '../../scripts/camera-replay-tools.mjs';

const fixture = () => ({
  schema: 1,
  mode: 'camera-timeline-diagnostic',
  dataLossOccurred: false,
  anchors: [
    { name: 'start', pageMs: 0 },
    { name: 'end', pageMs: 20 },
  ],
  clockBracket: { beforeMs: 4, afterMs: 6, timestampMs: 1005 },
  windows: [{ id: 'core/0/zoom', startedAt: 2, completedAt: 12 }],
  profile: {
    startTime: 990000,
    endTime: 1030000,
    nodes: [
      {
        id: 1,
        callFrame: { functionName: '(program)', url: '', lineNumber: -1 },
      },
    ],
    samples: Array(40).fill(1),
    timeDeltas: Array(40).fill(1000),
  },
  traceEvents: [
    { name: 'start', ts: 1000000, ph: 'I', pid: 1, tid: 2 },
    { name: 'end', ts: 1020000, ph: 'I', pid: 1, tid: 2 },
    {
      name: 'ThreadControllerImpl::RunTask',
      ts: 1000000,
      dur: 10000,
      ph: 'X',
      pid: 1,
      tid: 2,
    },
    { name: 'MinorGC', ts: 1001000, dur: 4000, ph: 'X', pid: 1, tid: 2 },
    {
      name: 'V8.GC_SCAVENGER',
      ts: 1002000,
      dur: 2000,
      ph: 'X',
      pid: 1,
      tid: 2,
    },
    // Worker/process GC must not be counted as a renderer main-thread pause.
    { name: 'MinorGC', ts: 1000000, dur: 20000, ph: 'X', pid: 1, tid: 3 },
    { name: 'MinorGC', ts: 1000000, dur: 20000, ph: 'X', pid: 2, tid: 2 },
  ],
});
test('clips and unions nested, touching and disjoint intervals', () => {
  assert.equal(overlap([0, 3], [2, 5]), 1);
  assert.equal(overlap([0, 2], [2, 5]), 0);
  assert.equal(
    covered(
      [
        [0, 5],
        [1, 4],
        [4, 7],
        [9, 12],
      ],
      [2, 10],
    ),
    6,
  );
});
test('aligns clocks, clips samples and counts only main-thread GC without nesting duplication', () => {
  const {
    windows: [w],
    clock,
  } = analyzeCameraTimeline(fixture());
  assert.equal(clock.offsetMs, 1000);
  assert.equal(w.elapsedMs, 10);
  assert.equal(w.taskCoveredMs, 8);
  assert.equal(w.outsideRecordedTasksMs, 2);
  assert.equal(w.gcCoveredMs, 3);
  assert.equal(w.sampledResidenceMs, 10);
  assert.deepEqual(w.sampleSelfTop, [['(program) :0', 10]]);
});
for (const [name, mutate] of [
  ['duplicate anchor', (x) => x.traceEvents.push(x.traceEvents[0])],
  ['missing anchor', (x) => x.traceEvents.shift()],
  [
    'clock drift',
    (x) => {
      x.anchors[1].pageMs = 19;
    },
  ],
  [
    'clock mismatch',
    (x) => {
      x.clockBracket.timestampMs += 10;
    },
  ],
  [
    'wide calibration',
    (x) => {
      x.clockBracket.afterMs = 20;
    },
  ],
  [
    'profile clock mismatch',
    (x) => {
      x.profile.startTime = 1010000;
    },
  ],
  [
    'renderer migration',
    (x) => {
      x.traceEvents[1].pid = 2;
    },
  ],
  [
    'window outside anchors',
    (x) => {
      x.windows[0].startedAt = -1;
    },
  ],
  [
    'negative engine window',
    (x) => {
      x.windows[0].completedAt = 1;
    },
  ],
  [
    'unknown sampled node',
    (x) => {
      x.profile.samples[0] = 2;
    },
  ],
  [
    'negative sample duration',
    (x) => {
      x.profile.timeDeltas[0] = -1;
    },
  ],
  ['sample length mismatch', (x) => x.profile.timeDeltas.pop()],
  [
    'lost events',
    (x) => {
      x.dataLossOccurred = true;
    },
  ],
  [
    'missing main-thread tasks',
    (x) => {
      x.traceEvents = x.traceEvents.filter((e) => e.ph !== 'X');
    },
  ],
]) {
  test(`rejects ${name}`, () => {
    const x = fixture();
    mutate(x);
    assert.throws(() => analyzeCameraTimeline(x));
  });
}
test('ordinary replay comparison rejects a diagnostic before reading its timing', () => {
  assert.throws(
    () => compareReplays({ schema: 1, mode: 'camera-timeline-diagnostic' }, {}),
    /Diagnostic/,
  );
});

test('keeps long sample gaps unassigned rather than attributing a stall to the next stack', () => {
  const x = fixture();
  x.profile.samples = [1, 1, 1];
  x.profile.timeDeltas = [10000, 10000, 10000];
  const w = analyzeCameraTimeline(x).windows[0];
  assert.equal(w.sampledResidenceMs, 0);
  assert.equal(w.sparseSampleOverlapMs, 10);
  assert.equal(w.sampleIntervalMaxMs, 10);
  assert.deepEqual(w.sampleSelfTop, []);
});

const traceFixture = () => {
  const x = fixture();
  delete x.profile;
  return { ...x, captureKind: 'trace-only' };
};
test('independent trace coverage has no CPU-sampling fields', () => {
  const x = traceFixture();
  const result = analyzeCameraTrace(x),
    w = result.windows[0];
  assert.equal(result.captureKind, 'trace-only');
  assert.equal(result.clock.offsetMs, 1000);
  assert.equal(w.elapsedMs, 10);
  assert.equal(w.taskCoveredMs, 8);
  assert.equal(w.outsideRecordedTasksMs, 2);
  assert.equal(w.gcCoveredMs, 3);
  assert.deepEqual(
    Object.keys(w).sort(),
    [
      'id',
      'startedAt',
      'completedAt',
      'elapsedMs',
      'taskCoveredMs',
      'outsideRecordedTasksMs',
      'gcCoveredMs',
      'traceInclusiveTop',
    ].sort(),
  );
  assert(!('sampleIntervalMaxMs' in result));
  assert.throws(() => analyzeCameraTimeline(x), /CPU profile/);
});
for (const [name, mutate] of [
  ['unmarked trace', (x) => delete x.captureKind],
  [
    'profile capture',
    (x) => {
      x.captureKind = 'profile';
    },
  ],
  [
    'injected invalid profile',
    (x) => {
      x.profile = { timeDeltas: [-1] };
    },
  ],
  [
    'undefined profile property',
    (x) => {
      x.profile = undefined;
    },
  ],
  ['duplicate anchor', (x) => x.traceEvents.push(x.traceEvents[0])],
  ['missing anchor', (x) => x.traceEvents.shift()],
  [
    'clock drift',
    (x) => {
      x.anchors[1].pageMs = 19;
    },
  ],
  [
    'clock mismatch',
    (x) => {
      x.clockBracket.timestampMs += 10;
    },
  ],
  [
    'wide bracket',
    (x) => {
      x.clockBracket.afterMs = 20;
    },
  ],
  [
    'renderer migration',
    (x) => {
      x.traceEvents[1].pid = 2;
    },
  ],
  [
    'thread migration',
    (x) => {
      x.traceEvents[1].tid = 3;
    },
  ],
  [
    'out-of-range window',
    (x) => {
      x.windows[0].startedAt = -1;
    },
  ],
  [
    'negative window',
    (x) => {
      x.windows[0].completedAt = 1;
    },
  ],
  [
    'empty windows',
    (x) => {
      x.windows = [];
    },
  ],
  [
    'lost events',
    (x) => {
      x.dataLossOccurred = true;
    },
  ],
  [
    'missing main tasks',
    (x) => {
      x.traceEvents = x.traceEvents.filter((e) => e.ph !== 'X');
    },
  ],
])
  test(`trace-only rejects ${name}`, () => {
    const x = traceFixture();
    mutate(x);
    assert.throws(() => analyzeCameraTrace(x));
  });
