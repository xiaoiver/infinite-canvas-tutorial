import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
export function cameraTraceHash(workload, trace, viewport) {
  return createHash('sha256')
    .update(JSON.stringify({ schema: 1, workload, trace, viewport }))
    .digest('hex');
}
export function replayStats(values) {
  assert(
    values.length > 0 && values.every(Number.isFinite),
    'Finite nonempty timing samples required',
  );
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1),
  };
}
function rows(capture) {
  assert.equal(capture.schema, 1, 'Replay schema differs');
  assert(
    capture.mode === undefined,
    'Diagnostic captures cannot qualify as ordinary timing',
  );
  assert.equal(
    capture.source.dirty,
    false,
    'Uncommitted source is not qualified',
  );
  assert(
    /^[a-f0-9]{40}$/.test(capture.source.head) &&
      /^[a-f0-9]{40}$/.test(capture.source.tree),
    'Missing source identity',
  );
  assert(
    new Set(capture.trace.map((p) => p.id)).size === capture.trace.length,
    'Duplicate pose id',
  );
  assert(
    capture.trace.every(
      (p) =>
        typeof p.id === 'string' &&
        p.id &&
        [p.x, p.y, p.zoom].every(Number.isFinite) &&
        p.zoom > 0,
    ),
    'Invalid trace camera',
  );
  assert.equal(
    capture.traceHash,
    cameraTraceHash(capture.workload, capture.trace, capture.viewport),
    'Trace hash differs',
  );
  assert.equal(
    capture.uploadProbeRestored,
    undefined,
    'Stroke upload diagnostics cannot qualify as ordinary timing',
  );
  const out = new Map();
  for (const result of capture.results) {
    assert.equal(
      result.uploadProbeRestored,
      undefined,
      'Stroke upload diagnostics cannot qualify as ordinary timing',
    );
    assert.equal(result.documentSame, true, 'Replay changed the document');
    assert.equal(result.teardown, 'passed', 'Teardown not qualified');
    for (const round of result.rounds) {
      assert.deepEqual(
        round.steps.map((s) => s.id),
        capture.trace.map((s) => s.id),
        'Pose order differs',
      );
      for (const [i, step] of round.steps.entries()) {
        assert.equal(
          step.strokeUploads,
          undefined,
          'Stroke upload diagnostics cannot qualify as ordinary timing',
        );
        const { id, ...view } = capture.trace[i];
        assert.deepEqual(step.requested, view, 'Requested camera differs');
        assert(step.frames.length > 0, 'Missing completed frame');
        const frame = step.frames.at(-1);
        assert(
          Math.abs(frame.view.x - view.x) <= 1e-4 &&
            Math.abs(frame.view.y - view.y) <= 1e-4 &&
            Math.abs(frame.view.zoom - view.zoom) <=
              Math.max(1, Math.abs(view.zoom)) * 1e-6,
          'Derived camera differs',
        );
        const visible = frame.data.visibleIds ?? frame.data.visibleIndices;
        assert(
          Array.isArray(visible) && new Set(visible).size === visible.length,
          'Invalid visible membership',
        );
        assert(
          step.frames.every(
            (f) =>
              Number.isFinite(f.elapsed) &&
              f.elapsed >= 0 &&
              Number.isFinite(f.completedAt),
          ),
          'Invalid frame timing',
        );
        for (const f of step.frames) {
          assert.equal(
            f.data.phaseDetail,
            undefined,
            'Detailed phase diagnostics cannot qualify as ordinary timing',
          );
          const hasObservation = [
            'startedAt',
            'observedAt',
            'observationMs',
          ].some((k) => k in f);
          if (!hasObservation) continue; // Legacy schema-1 captures have no observer clock.
          assert(
            ['startedAt', 'observedAt', 'observationMs'].every((k) =>
              Number.isFinite(f[k]),
            ),
            'Incomplete observation timing',
          );
          assert(
            f.startedAt <= f.completedAt &&
              f.completedAt <= f.observedAt &&
              f.observationMs >= 0,
            'Invalid observation timing',
          );
          assert(
            Math.abs(f.completedAt - f.startedAt - f.elapsed) <= 1e-3 &&
              Math.abs(f.observedAt - f.completedAt - f.observationMs) <= 1e-3,
            'Inconsistent observation timing',
          );
        }
        if ('operationToResultMs' in step) {
          assert(
            Number.isFinite(step.operationToResultMs) &&
              step.operationToResultMs >= step.operationToFrameMs,
            'Invalid result readiness',
          );
          if (Number.isFinite(frame.observationMs))
            assert(
              step.operationToResultMs + 1e-3 >=
                step.operationToFrameMs + frame.observationMs,
              'Result precedes observation',
            );
        }
        assert(
          visible.every(
            (id) => typeof id === 'string' || (Number.isInteger(id) && id >= 0),
          ),
          'Invalid visible identifier',
        );
        assert(
          frame.data.surface &&
            ['width', 'height', 'bufferWidth', 'bufferHeight', 'dpr'].every(
              (k) =>
                Number.isFinite(frame.data.surface[k]) &&
                frame.data.surface[k] > 0,
            ),
          'Missing actual surface',
        );
        assert(
          Number.isFinite(step.operationToFrameMs) &&
            step.operationToFrameMs >= 0,
          'Invalid completion timing',
        );
        const key = `${result.backend}/${result.mode}/${round.index}/${id}`;
        assert(!out.has(key), 'Duplicate replay row');
        out.set(key, { step, frame, visible });
      }
    }
  }
  assert(out.size > 0, 'Missing replay results');
  return out;
}
export function summarizeReplay(capture) {
  const all = rows(capture),
    groups = new Map();
  for (const [key, row] of all) {
    const group = key.split('/').slice(0, 3).join('/');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(row);
  }
  return [...groups].map(([key, values]) => ({
    key,
    steps: values.length,
    preparationFrames: values.reduce((n, r) => n + r.step.frames.length - 1, 0),
    visible: [
      Math.min(...values.map((r) => r.visible.length)),
      Math.max(...values.map((r) => r.visible.length)),
    ],
    matchedFrameMs: replayStats(values.map((r) => r.frame.elapsed)),
    engineTotalMs: replayStats(
      values.map((r) => r.step.frames.reduce((n, f) => n + f.elapsed, 0)),
    ),
    operationToFrameMs: replayStats(
      values.map((r) => r.step.operationToFrameMs),
    ),
    ...(values.every(
      ({ step }) =>
        Number.isFinite(step.operationToResultMs) &&
        step.frames.every((f) => Number.isFinite(f.observationMs)),
    )
      ? {
          observationTotalMs: replayStats(
            values.map(({ step }) =>
              step.frames.reduce((sum, f) => sum + f.observationMs, 0),
            ),
          ),
          operationToResultMs: replayStats(
            values.map(({ step }) => step.operationToResultMs),
          ),
        }
      : {}),
  }));
}
export function compareReplays(
  before,
  after,
  { requireNativeParity = false } = {},
) {
  for (const key of ['workload', 'traceHash', 'browser', 'node', 'viewport'])
    assert.deepEqual(before[key], after[key], `Capture ${key} differs`);
  const a = rows(before),
    b = rows(after);
  assert.deepEqual([...a.keys()], [...b.keys()], 'Cohort/round order differs');
  const nativeChanges = [];
  for (const [key, x] of a) {
    const y = b.get(key);
    assert.deepEqual(
      x.frame.view,
      y.frame.view,
      `Actual camera differs: ${key}`,
    );
    assert.deepEqual(
      x.visible,
      y.visible,
      `Visible membership differs: ${key}`,
    );
    assert.deepEqual(
      x.frame.data.surface,
      y.frame.data.surface,
      `Actual surface differs: ${key}`,
    );
    const fields = ['drawcalls', 'indices', 'arrayVertices'];
    if (fields.some((k) => x.frame.data.native[k] !== y.frame.data.native[k])) {
      if (requireNativeParity)
        assert.deepEqual(
          fields.map((k) => x.frame.data.native[k]),
          fields.map((k) => y.frame.data.native[k]),
          `Native submissions differ: ${key}`,
        );
      nativeChanges.push({
        key,
        before: x.frame.data.native,
        after: y.frame.data.native,
      });
    }
  }
  return {
    matchedSteps: a.size,
    before: summarizeReplay(before),
    after: summarizeReplay(after),
    nativeChanges,
  };
}
