import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraTraceHash,
  compareReplays,
  replayStats,
  summarizeReplay,
} from '../../scripts/camera-replay-tools.mjs';
const capture = () => {
  const trace = [{ id: 'one', x: 0, y: 0, zoom: 1 }],
    viewport = { width: 800, height: 600, dpr: 1 };
  return {
    schema: 1,
    workload: 'strokes',
    source: { dirty: false, head: 'a'.repeat(40), tree: 'b'.repeat(40) },
    browser: 'test',
    node: 'test',
    trace,
    viewport,
    traceHash: cameraTraceHash('strokes', trace, viewport),
    results: [
      {
        backend: 'core',
        mode: 'scoped',
        documentSame: true,
        teardown: 'passed',
        rounds: [
          {
            index: 0,
            steps: [
              {
                id: 'one',
                requested: { x: 0, y: 0, zoom: 1 },
                operationToFrameMs: 3,
                frames: [
                  {
                    view: { x: 0, y: 0, zoom: 1 },
                    elapsed: 2,
                    completedAt: 10,
                    data: {
                      surface: {
                        width: 800,
                        height: 600,
                        bufferWidth: 800,
                        bufferHeight: 600,
                        dpr: 1,
                      },
                      visibleIndices: [0, 1],
                      native: { drawcalls: 2, indices: 30, arrayVertices: 4 },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
};
test('qualifies matching poses/membership and reports native changes explicitly', () => {
  const a = capture(),
    b = capture();
  assert.equal(compareReplays(a, b).matchedSteps, 1);
  b.results[0].rounds[0].steps[0].frames[0].data.native.drawcalls = 1;
  assert.equal(compareReplays(a, b).nativeChanges.length, 1);
  assert.throws(
    () => compareReplays(a, b, { requireNativeParity: true }),
    /Native submissions/,
  );
});
test('rejects wrong workload, trace, source, viewport, camera, visible membership and duplicate rows', () => {
  for (const mutate of [
    (b) => (b.workload = 'workflow'),
    (b) => (b.trace[0].x = 1),
    (b) => (b.source.dirty = true),
    (b) => (b.viewport.dpr = 2),
    (b) =>
      (b.results[0].rounds[0].steps[0].frames[0].data.surface.bufferWidth = 1600),
    (b) => (b.results[0].rounds[0].steps[0].frames[0].view.x = 5),
    (b) =>
      (b.results[0].rounds[0].steps[0].frames[0].data.visibleIndices = [1, 2]),
    (b) => b.results.push(b.results[0]),
  ]) {
    const a = capture(),
      b = capture();
    mutate(b);
    assert.throws(() => compareReplays(a, b));
  }
});
test('uses nearest-rank percentiles without mutating samples', () => {
  const xs = [10, 1, 5, 2];
  assert.deepEqual(replayStats(xs), { p50: 2, p95: 10, max: 10 });
  assert.deepEqual(xs, [10, 1, 5, 2]);
  assert.throws(() => replayStats([]));
});

test('reports observation/readiness separately while retaining legacy capture compatibility', () => {
  const old = capture();
  assert.equal('observationTotalMs' in summarizeReplay(old)[0], false);
  const current = capture();
  const step = current.results[0].rounds[0].steps[0];
  Object.assign(step.frames[0], {
    startedAt: 8,
    observedAt: 30,
    observationMs: 20,
  });
  step.operationToResultMs = 24;
  assert.equal(compareReplays(old, current).matchedSteps, 1);
  const row = summarizeReplay(current)[0];
  assert.deepEqual(row.matchedFrameMs, { p50: 2, p95: 2, max: 2 });
  assert.deepEqual(row.observationTotalMs, { p50: 20, p95: 20, max: 20 });
  assert.deepEqual(row.operationToResultMs, { p50: 24, p95: 24, max: 24 });
  for (const change of [
    (s) => {
      delete s.frames[0].observedAt;
    },
    (s) => {
      s.frames[0].observationMs = -1;
    },
    (s) => {
      s.frames[0].startedAt = 1;
    },
    (s) => {
      s.operationToResultMs = 22;
    },
    (s) => {
      s.operationToResultMs = NaN;
    },
  ]) {
    const invalid = structuredClone(current);
    change(invalid.results[0].rounds[0].steps[0]);
    assert.throws(() => summarizeReplay(invalid));
  }
});

test('rejects unlabelled detailed phase instrumentation while retaining legacy plan scopes', () => {
  const a = capture(),
    b = capture();
  b.results[0].rounds[0].steps[0].frames[0].data.phases = {
    'batch.plan': { calls: 1, inclusiveMs: 1, exclusiveMs: 1 },
  };
  compareReplays(a, b);
  b.results[0].rounds[0].steps[0].frames[0].data.phaseDetail = 'camera';
  assert.throws(() => compareReplays(a, b), /Detailed phase diagnostics/);
});

test('rejects upload counters or restoration markers even when the diagnostic mode is missing', () => {
  for (const mutate of [
    (x) => (x.uploadProbeRestored = true),
    (x) => {
      x.results[0].rounds[0].steps[0].strokeUploads = { packedCalls: 1 };
    },
  ]) {
    const x = capture();
    mutate(x);
    assert.throws(() => compareReplays(x, x), /upload diagnostics/);
  }
});
