import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraTraceHash,
  compareReplays,
  replayStats,
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
