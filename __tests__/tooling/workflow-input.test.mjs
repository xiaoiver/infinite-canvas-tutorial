import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareWorkflowInputs } from '../../scripts/workflow-input-tools.mjs';
// Synthetic schema fixtures exercise qualification, never performance claims.
import { makeWorkflowInputCapture as capture } from './helpers/workflow-input-fixture.mjs';
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

for (const key of ['phases', 'phaseDetail'])
  test(`rejects unlabelled detailed ${key}`, () => {
    const a = capture(),
      b = capture();
    first(b).frames[0].data[key] = key === 'phases' ? {} : 'camera';
    assert.throws(() => compareWorkflowInputs(a, b), /Diagnostic phases/);
  });

test('rejects upload counters or restoration markers even when the diagnostic mode is missing', () => {
  for (const mutate of [
    (x) => (x.uploadProbeRestored = true),
    (x) => {
      x.rounds[0].steps[0].strokeUploads = { packedCalls: 1 };
    },
  ]) {
    const x = capture();
    mutate(x);
    assert.throws(() => compareWorkflowInputs(x, x), /upload diagnostics/);
  }
});
