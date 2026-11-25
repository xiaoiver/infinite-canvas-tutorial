import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareWorkflowInputs } from '../../scripts/workflow-input-tools.mjs';
// Synthetic schema fixtures exercise qualification, never performance claims.
const capture = () => {
  const deltas = [-100, -100, 100, 100],
    view = { x: 0, y: 0, zoom: 1 };
  return {
    schema: 1,
    workload: 'workflow-trusted-wheel',
    count: 24,
    dpr: 1,
    viewport: { width: 1500, height: 980 },
    browser: 'test',
    node: 'test',
    source: { dirty: false, head: 'a'.repeat(40), tree: 'b'.repeat(40) },
    documentSame: true,
    teardown: 'passed',
    deltas,
    rounds: [0, 1].map((index) => ({
      index,
      initial: {
        demo: { view: { ...view } },
        state: { visible: { cards: 24, edges: 24 } },
      },
      validationBefore: { errors: [], elapsed: 0 },
      validationAfter: { errors: [], elapsed: 0 },
      steps: deltas.map((deltaY) => ({
        input: {
          isTrusted: true,
          deltaMode: 0,
          deltaX: 0,
          deltaY,
          clientX: 642,
          clientY: 523,
        },
        receivedAt: 8,
        inputToFrameMs: 3,
        inputToResultMs: 4,
        requested: { ...view },
        frames: [
          {
            view: { ...view },
            startedAt: 10,
            completedAt: 11,
            observedAt: 12,
            elapsed: 1,
            observationMs: 1,
            data: {
              uiView: { ...view },
              surface: {
                width: 1148,
                height: 914,
                bufferWidth: 1148,
                bufferHeight: 914,
                dpr: 1,
              },
              visibleIds: ['node-1', 'edge-1'],
              native: {
                bufferCreates: 2,
                bufferDeletes: 2,
                bufferAllocations: 2,
                drawcalls: 1,
                indices: 15,
                arrayVertices: 4,
                bufferUploads: 2,
                bufferBytes: 64,
                uniformUploads: 1,
                uniformBytes: 16,
              },
              state: {
                visible: { cards: 1, edges: 1, other: 1 },
                allocatedBufferBytes: 64,
                resources: [{ side: 'offscreen', live: { Buffer: 2 } }],
              },
            },
          },
        ],
      })),
    })),
  };
};
const first = (c) => c.rounds[0].steps[0];
test('reports separate first/warm input, engine and observation clocks plus native allocation work', () => {
  const a = capture(),
    b = capture();
  b.source.head = 'c'.repeat(40);
  const result = compareWorkflowInputs(a, b);
  assert.equal(result.matchedSteps, 8);
  assert.equal(result.nativeParity, 'all counters');
  assert.deepEqual(result.before.rounds[0].engineWallMs, {
    p50: 1,
    p95: 1,
    max: 1,
    total: 4,
  });
  assert.equal(result.before.rounds[1].inputToFrameMs.p50, 3);
  assert.equal(result.before.rounds[0].nativeTotals.bufferCreates, 8);
  assert.equal(result.after.rounds[0].longFrames.length, 3);
  assert.equal(result.after.source.head, b.source.head);
});
for (const [name, mutate] of [
  ['diagnostic mode', (c) => (c.mode = 'stroke-work-diagnostic')],
  ['unlabelled diagnostic counters', (c) => (c.geometryWork = [])],
  ['unlabelled step instrumentation', (c) => (first(c).geometryWork = {})],
  ['dirty source', (c) => (c.source.dirty = true)],
  ['missing source', (c) => delete c.source.tree],
  ['different runtime', (c) => (c.browser = 'other')],
  ['incomplete traversal', (c) => c.rounds[0].steps.pop()],
  ['missing warm round', (c) => c.rounds.pop()],
  ['synthetic input', (c) => (first(c).input.isTrusted = false)],
  ['different input delta', (c) => (first(c).input.deltaY = 1)],
  ['different anchor', (c) => first(c).input.clientX++],
  [
    'extra engine execution',
    (c) => first(c).frames.push(structuredClone(first(c).frames[0])),
  ],
  ['missing observer', (c) => delete first(c).frames[0].observationMs],
  ['inconsistent engine clock', (c) => (first(c).frames[0].elapsed = 2)],
  ['inconsistent input clock', (c) => (first(c).inputToFrameMs = 2)],
  ['result before observation', (c) => (first(c).inputToResultMs = 3)],
  ['GPU gate error', (c) => (c.rounds[0].validationAfter.errors = [1280])],
  ['unqualified document', (c) => (c.documentSame = false)],
  ['pending teardown', (c) => (c.teardown = 'pending')],
  ['different surface', (c) => first(c).frames[0].data.surface.width++],
  ['different logical view', (c) => first(c).frames[0].data.uiView.x++],
  ['different camera', (c) => first(c).frames[0].view.x++],
  [
    'different membership',
    (c) => (first(c).frames[0].data.visibleIds[0] = 'node-2'),
  ],
  [
    'duplicate membership',
    (c) => (first(c).frames[0].data.visibleIds[1] = 'node-1'),
  ],
  [
    'different live resources',
    (c) => first(c).frames[0].data.state.resources[0].live.Buffer++,
  ],
  [
    'different allocated bytes',
    (c) => first(c).frames[0].data.state.allocatedBufferBytes++,
  ],
  [
    'missing native field',
    (c) => delete first(c).frames[0].data.native.bufferUploads,
  ],
  [
    'nonfinite native field',
    (c) => (first(c).frames[0].data.native.bufferBytes = NaN),
  ],
  [
    'different buffer churn with identical draws',
    (c) => first(c).frames[0].data.native.bufferCreates++,
  ],
  [
    'different upload bytes with identical draws',
    (c) => first(c).frames[0].data.native.bufferBytes++,
  ],
])
  test(`rejects ${name}`, () => {
    const a = capture(),
      b = capture();
    mutate(b);
    assert.throws(() => compareWorkflowInputs(a, b));
  });
test('compares unexpected numeric native counters instead of silently dropping them', () => {
  const a = capture(),
    b = capture();
  first(a).frames[0].data.native.futureCounter = 4;
  first(b).frames[0].data.native.futureCounter = 4;
  assert.equal(compareWorkflowInputs(a, b).matchedSteps, 8);
  first(b).frames[0].data.native.futureCounter = 5;
  assert.throws(() => compareWorkflowInputs(a, b), /native/);
});

test('rejects equally mislabelled actual DPR in both captures', () => {
  const a = capture(),
    b = capture();
  for (const c of [a, b]) first(c).frames[0].data.surface.dpr = 2;
  assert.throws(() => compareWorkflowInputs(a, b), /Actual DPR/);
});
test('rejects equally stale UI views even when native cameras match', () => {
  const a = capture(),
    b = capture();
  for (const c of [a, b]) first(c).frames[0].data.uiView.x = 3;
  assert.throws(() => compareWorkflowInputs(a, b), /Logical x/);
});
