import {
  qualifyDrawingBuffer,
  sameDrawingBufferScope,
  drawingBufferSummary,
} from './drawing-buffer-tools.mjs';
import { qualifyWorkflowComposition } from './workflow-composition-tools.mjs';
import {
  sameStrokeTextureScope,
  qualifyStrokeTexture,
} from './stroke-texture-bench-tools.mjs';
import assert from 'node:assert/strict';
import {
  cameraTraceHash,
  replayStats,
  summarizeReplay,
} from './camera-replay-tools.mjs';

const nativeFields = [
  'bufferCreates',
  'bufferDeletes',
  'bufferAllocations',
  'drawcalls',
  'indices',
  'arrayVertices',
  'bufferUploads',
  'bufferBytes',
  'uniformUploads',
  'uniformBytes',
];
const nonnegative = (v) => Number.isFinite(v) && v >= 0;
const count = (v) => Number.isSafeInteger(v) && v >= 0;
function view(v) {
  assert(
    v && ['x', 'y', 'zoom'].every((k) => Number.isFinite(v[k])) && v.zoom > 0,
    'Invalid logical view',
  );
}
function qualify(capture, composition = false) {
  qualifyDrawingBuffer(capture);
  if (composition) qualifyWorkflowComposition(capture);
  else
    assert.equal(
      capture.composition,
      undefined,
      'Composition captures cannot qualify as ordinary timing',
    );
  assert.equal(capture.schema, 1, 'Unsupported input schema');
  assert.equal(
    capture.workload,
    'workflow-trusted-wheel',
    'Trusted-wheel workload required',
  );
  assert(
    (composition
      ? capture.mode === 'workflow-composition-diagnostic'
      : capture.mode === undefined) &&
      !('geometryWork' in capture) &&
      !('memory' in capture),
    'Diagnostic captures cannot qualify as ordinary timing',
  );
  assert.equal(
    capture.uploadProbeRestored,
    undefined,
    'Stroke upload diagnostics cannot qualify as ordinary timing',
  );
  assert([24, 2400].includes(capture.count), 'Unsupported node count');
  assert.equal(capture.dpr, 1, 'DPR 1 protocol required');
  assert(
    capture.viewport &&
      ['width', 'height'].every(
        (k) => Number.isFinite(capture.viewport[k]) && capture.viewport[k] > 0,
      ),
    'Invalid outer viewport',
  );
  assert(
    ['browser', 'node'].every(
      (k) => typeof capture[k] === 'string' && capture[k],
    ),
    'Missing runtime identity',
  );
  assert.equal(capture.documentSame, true, 'Document equality not qualified');
  assert.equal(capture.teardown, 'passed', 'Teardown not qualified');
  const half = capture.count === 2400 ? 10 : 2;
  assert.deepEqual(
    capture.deltas,
    [...Array(half).fill(-100), ...Array(half).fill(100)],
    'Wheel protocol differs',
  );
  assert.deepEqual(
    capture.rounds.map((r) => r.index),
    [0, 1],
    'First and warm rounds required',
  );
  for (const round of capture.rounds) {
    assert.equal(
      round.initial.state.visible.cards,
      capture.count,
      'Incomplete initial cards',
    );
    assert.equal(
      round.initial.state.visible.edges,
      capture.count,
      'Incomplete initial edges',
    );
    view(round.initial.demo.view);
    for (const gate of [round.validationBefore, round.validationAfter]) {
      assert(gate && nonnegative(gate.elapsed), 'Missing GPU validation gate');
      assert.deepEqual(gate.errors, [], 'GPU validation failed');
    }
    assert.equal(
      round.steps.length,
      capture.deltas.length,
      'Incomplete wheel traversal',
    );
    for (const [i, step] of round.steps.entries()) {
      assert(!('geometryWork' in step), 'Diagnostic step cannot qualify');
      if (!composition)
        assert.equal(
          step.compositionHost,
          undefined,
          'Composition host clocks cannot qualify as ordinary timing',
        );
      assert.equal(
        step.strokeUploads,
        undefined,
        'Stroke upload diagnostics cannot qualify as ordinary timing',
      );
      assert.equal(step.input.isTrusted, true, 'Native trusted input required');
      assert.equal(step.input.deltaMode, 0, 'Pixel wheel input required');
      assert.equal(step.input.deltaX, 0, 'Unexpected horizontal input');
      assert.equal(step.input.deltaY, capture.deltas[i], 'Input delta differs');
      assert(
        ['clientX', 'clientY'].every((k) => Number.isFinite(step.input[k])),
        'Missing input anchor',
      );
      assert.equal(
        step.frames.length,
        1,
        'Exactly one engine execution per input required',
      );
      const frame = step.frames[0],
        { data } = frame;
      assert(
        data.phases === undefined && data.phaseDetail === undefined,
        'Diagnostic phases cannot qualify as ordinary timing',
      );
      assert(
        ['startedAt', 'completedAt', 'observedAt', 'observationMs'].every((k) =>
          nonnegative(frame[k]),
        ),
        'Observer clocks required',
      );
      assert(
        nonnegative(step.receivedAt) &&
          step.receivedAt <= frame.startedAt &&
          nonnegative(step.inputToFrameMs) &&
          nonnegative(step.inputToResultMs),
        'Invalid input clock',
      );
      assert(
        Math.abs(frame.completedAt - step.receivedAt - step.inputToFrameMs) <=
          1e-3,
        'Inconsistent input completion clock',
      );
      view(data.uiView);
      assert.equal(
        data.surface.dpr,
        capture.dpr,
        'Actual DPR differs from protocol',
      );
      assert.equal(
        Math.fround(data.uiView.x),
        step.requested.x,
        'Logical x did not reach input target',
      );
      assert.equal(
        Math.fround(data.uiView.y),
        step.requested.y,
        'Logical y did not reach input target',
      );
      assert(
        Math.abs(data.uiView.zoom - step.requested.zoom) <=
          Math.max(1, Math.abs(step.requested.zoom)) * 1e-6,
        'Logical zoom did not reach input target',
      );
      assert(
        data.state.webglError === undefined,
        'Per-frame GPU error state is not qualified',
      );
      assert(
        data.native &&
          nativeFields.every((k) => count(data.native[k])) &&
          Object.values(data.native).every(count),
        'Incomplete native counters',
      );
      assert(data.native.drawcalls > 0, 'Missing native submission');
      assert(count(data.state.allocatedBufferBytes), 'Invalid allocated bytes');
      assert(
        ['cards', 'edges', 'other'].every((k) => count(data.state.visible[k])),
        'Invalid visibility counts',
      );
      // Graph membership excludes adorners; `other` can include selection.
      for (const [kind, prefix] of [
        ['cards', 'node-'],
        ['edges', 'edge-'],
      ])
        assert.equal(
          data.visibleIds.filter(
            (id) => typeof id === 'string' && id.startsWith(prefix),
          ).length,
          data.state.visible[kind],
          'Graph visibility count and identity differ',
        );
      assert.equal(
        data.visibleIds.length,
        data.state.visible.cards + data.state.visible.edges,
        'Unexpected graph member',
      );
      assert(
        Array.isArray(data.state.resources) &&
          data.state.resources.length > 0 &&
          data.state.resources.every(
            (r) =>
              typeof r.side === 'string' &&
              r.live &&
              Object.keys(r.live).length > 0 &&
              Object.values(r.live).every(count),
          ),
        'Invalid live resource maps',
      );
    }
    // Reuse the existing camera/observer validation with the trusted-input clock
    // as the operation boundary. No legacy API-edit timing is pooled here.
    const trace = round.steps.map((s, i) => ({
      id: String(i),
      ...s.requested,
    }));
    summarizeReplay({
      // Adapt the validated input workload to the shared frame-clock schema.
      // The original diagnostic capture retains its mode and CSS metadata.
      schema: capture.schema,
      workload: capture.workload,
      source: capture.source,
      viewport: capture.viewport,
      browser: capture.browser,
      node: capture.node,
      strokeTexture: capture.strokeTexture,
      preserveDrawingBuffer: capture.preserveDrawingBuffer,
      textureProbeRestored: capture.textureProbeRestored,
      trace,
      traceHash: cameraTraceHash(capture.workload, trace, capture.viewport),
      results: [
        {
          backend: 'ecs',
          drawingBufferContext: capture.drawingBufferContext,
          drawingBufferContextAfter: capture.drawingBufferContextAfter,
          mode: 'trusted-wheel',
          documentSame: true,
          teardown: 'passed',
          rounds: [
            {
              index: round.index,
              steps: round.steps.map((s, i) => ({
                ...s,
                id: String(i),
                operationToFrameMs: s.inputToFrameMs,
                operationToResultMs: s.inputToResultMs,
              })),
            },
          ],
        },
      ],
    });
  }
  qualifyStrokeTexture(capture);
}
function summarize(capture, composition = false) {
  return capture.rounds.map((round) => {
    const frames = round.steps.map((s) => s.frames[0]);
    const stats = (values) => ({
      ...replayStats(values),
      total: values.reduce((a, b) => a + b, 0),
    });
    return {
      index: round.index,
      ...(composition
        ? {
            hostCommandToResultMs: stats(
              round.steps.map(
                (s) =>
                  s.compositionHost.resultObservedAt -
                  s.compositionHost.dispatchedAt,
              ),
            ),
            hostAcknowledgementMs: stats(
              round.steps.map(
                (s) =>
                  s.compositionHost.acknowledgedAt -
                  s.compositionHost.dispatchedAt,
              ),
            ),
          }
        : {}),
      ...(capture.preserveDrawingBuffer === undefined
        ? {}
        : {
            hostCommandToResultMs: stats(
              round.steps.map(
                (s) =>
                  s.drawingBufferHost.resultObservedAt -
                  s.drawingBufferHost.dispatchedAt,
              ),
            ),
          }),
      steps: frames.length,
      engineWallMs: stats(frames.map((f) => f.elapsed)),
      inputToFrameMs: stats(round.steps.map((s) => s.inputToFrameMs)),
      observationMs: stats(frames.map((f) => f.observationMs)),
      nativeTotals: Object.fromEntries(
        nativeFields.map((k) => [
          k,
          frames.reduce((n, f) => n + f.data.native[k], 0),
        ]),
      ),
      longFrames: frames
        .map((f, i) => ({
          step: i,
          engineWallMs: f.elapsed,
          inputToFrameMs: round.steps[i].inputToFrameMs,
          native: f.data.native,
          allocatedBufferBytes: f.data.state.allocatedBufferBytes,
        }))
        .sort((a, b) => b.engineWallMs - a.engineWallMs)
        .slice(0, 3),
    };
  });
}
/** Strict workload parity, not a statistical speedup or physical-FPS claim. */
function compare(before, after, composition = false) {
  qualify(before, composition);
  qualify(after, composition);
  sameStrokeTextureScope(before, after);
  sameDrawingBufferScope(before, after);
  for (const k of [
    'schema',
    'workload',
    'count',
    'deltas',
    'viewport',
    'dpr',
    'browser',
    'node',
  ])
    assert.deepEqual(before[k], after[k], `Capture ${k} differs`);
  for (const [ri, a] of before.rounds.entries()) {
    const b = after.rounds[ri];
    assert.deepEqual(
      a.initial.demo.view,
      b.initial.demo.view,
      `Initial camera differs: ${ri}`,
    );
    for (const [i, x] of a.steps.entries()) {
      const y = b.steps[i],
        key = `${ri}/${i}`,
        f = x.frames[0],
        g = y.frames[0];
      assert.deepEqual(x.input, y.input, `Input/anchor differs: ${key}`);
      assert.deepEqual(
        x.requested,
        y.requested,
        `Requested camera differs: ${key}`,
      );
      assert.deepEqual(f.view, g.view, `Actual camera differs: ${key}`);
      for (const k of ['surface', 'visibleIds', 'uiView', 'native'])
        assert.deepEqual(f.data[k], g.data[k], `Frame ${k} differs: ${key}`);
      for (const k of ['visible', 'resources', 'allocatedBufferBytes'])
        assert.deepEqual(
          f.data.state[k],
          g.data.state[k],
          `State ${k} differs: ${key}`,
        );
    }
  }
  return {
    matchedSteps: before.deltas.length * 2,
    nativeParity: 'all counters',
    before: {
      source: before.source,
      ...drawingBufferSummary(before),
      rounds: summarize(before, composition),
    },
    after: {
      source: after.source,
      ...drawingBufferSummary(after),
      rounds: summarize(after, composition),
    },
  };
}

export function compareWorkflowInputs(before, after) {
  return compare(before, after);
}
/** CSS-only ablations retain a distinct result mode and require the same source/GPU. */
export function compareWorkflowCompositions(control, candidate) {
  assert.equal(
    control.composition?.condition,
    'normal',
    'Normal composition control required',
  );
  assert.deepEqual(
    control.source,
    candidate.source,
    'Composition source differs',
  );
  assert.deepEqual(
    control.composition?.graphics,
    candidate.composition?.graphics,
    'Graphics identity differs',
  );
  return {
    mode: 'workflow-composition-diagnostic',
    conditions: [
      control.composition.condition,
      candidate.composition.condition,
    ],
    ...compare(control, candidate, true),
  };
}
export function summarizeWorkflowComposition(capture) {
  qualify(capture, true);
  return {
    mode: capture.mode,
    condition: capture.composition.condition,
    source: capture.source,
    rounds: summarize(capture, true),
  };
}
