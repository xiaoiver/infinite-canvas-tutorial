import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawingBufferMode,
  qualifyDrawingBuffer,
  sameDrawingBufferScope,
} from '../../scripts/drawing-buffer-tools.mjs';
import { compareWorkflowInputs } from '../../scripts/workflow-input-tools.mjs';
import { compareReplays } from '../../scripts/camera-replay-tools.mjs';
import { makeWorkflowInputCapture } from './helpers/workflow-input-fixture.mjs';
import { makeCameraReplayCapture } from './helpers/camera-replay-fixture.mjs';
const context = (value) => ({
  api: 'webgl2',
  overrideRestored: true,
  overrideAttempts: 1,
  renderer: 'test',
  version: 'test',
  shadingLanguageVersion: 'test',
  attributes: { alpha: true, antialias: true, preserveDrawingBuffer: value },
});
function settings(value, paired = false) {
  const c = paired ? makeCameraReplayCapture() : makeWorkflowInputCapture();
  c.preserveDrawingBuffer = value;
  if (paired) c.results[0].drawingBufferContext = context(value);
  else c.drawingBufferContext = context(value);
  const groups = c.results ?? [c];
  for (const g of groups)
    g.drawingBufferContextAfter = structuredClone(g.drawingBufferContext);
  for (const g of groups)
    for (const r of g.rounds)
      for (const [i, step] of r.steps.entries())
        step.drawingBufferHost = {
          dispatchedAt: i * 10,
          resultObservedAt: i * 10 + 4,
        };
  return c;
}
test('drawing-buffer settings are explicit and refuse mixed observers', () => {
  assert.equal(drawingBufferMode({}), undefined);
  assert.equal(drawingBufferMode({ DRAWING_BUFFER_PRESERVE: '0' }), false);
  assert.equal(drawingBufferMode({ DRAWING_BUFFER_PRESERVE: '1' }), true);
  for (const v of ['', false, 0, 'true', 'false', '2'])
    assert.throws(() => drawingBufferMode({ DRAWING_BUFFER_PRESERVE: v }));
  for (const key of [
    'WORKFLOW_COMPOSITION_CONDITION',
    'CAMERA_PHASES',
    'CAMERA_TIMELINE_DIR',
    'CAMERA_TIMELINE_MODE',
    'STROKE_UPLOAD_DIAGNOSTIC',
    'STROKE_TEXTURE_BENCH',
  ])
    assert.throws(() =>
      drawingBufferMode({ DRAWING_BUFFER_PRESERVE: '0', [key]: '0' }),
    );
});
test('actual context policy is qualified and only that attribute may differ', () => {
  const a = settings(true),
    b = settings(false);
  qualifyDrawingBuffer(a);
  qualifyDrawingBuffer(b);
  sameDrawingBufferScope(a, b);
  assert.equal(compareWorkflowInputs(a, b).matchedSteps, 8);
  const r = compareWorkflowInputs(a, b);
  assert.equal(r.before.preserveDrawingBuffer, true);
  assert.equal(r.after.preserveDrawingBuffer, false);
  b.drawingBufferContext.attributes.antialias = false;
  b.drawingBufferContextAfter.attributes.antialias = false;
  assert.throws(() => compareWorkflowInputs(a, b), /Graphics identity/);
});
test('both backend contexts retain independent identities and policies', () => {
  const a = settings(true, true),
    b = settings(false, true);
  for (const c of [a, b])
    c.results.push({
      ...c.results[0],
      backend: 'ecs',
      drawingBufferContext: context(c.preserveDrawingBuffer),
    });
  qualifyDrawingBuffer(a);
  qualifyDrawingBuffer(b);
  sameDrawingBufferScope(a, b);
  assert.equal(
    compareReplays(a, b, { requireNativeParity: true }).matchedSteps,
    2,
  );
  b.results[1].drawingBufferContext.attributes.preserveDrawingBuffer = true;
  assert.throws(() => compareReplays(a, b), /Actual drawing-buffer/);
});
for (const [name, mutate] of [
  ['unlabelled context', (c) => delete c.preserveDrawingBuffer],
  ['missing actual context', (c) => delete c.drawingBufferContext],
  [
    'ignored request',
    (c) => (c.drawingBufferContext.attributes.preserveDrawingBuffer = true),
  ],
  ['missing attributes', (c) => delete c.drawingBufferContext.attributes],
  ['missing API', (c) => delete c.drawingBufferContext.api],
  ['missing graphics identity', (c) => delete c.drawingBufferContext.renderer],
  ['invalid request', (c) => (c.preserveDrawingBuffer = '0')],
])
  test(`rejects drawing-buffer ${name}`, () => {
    const c = settings(false);
    mutate(c);
    assert.throws(() => qualifyDrawingBuffer(c));
  });
test('configured and default measurements are distinct scopes', () => {
  assert.throws(
    () => compareWorkflowInputs(makeWorkflowInputCapture(), settings(false)),
    /scopes differ/,
  );
  assert.throws(
    () => compareReplays(makeCameraReplayCapture(), settings(false, true)),
    /scopes differ/,
  );
});
test('paired settings reject changed uploads/resources even when draw/index counts match', () => {
  for (const field of ['uploads', 'resources']) {
    const a = settings(true, true),
      b = settings(false, true);
    if (field === 'uploads')
      b.results[0].rounds[0].steps[0].frames[0].data.native.bufferBytes = 1;
    else
      b.results[0].rounds[0].steps[0].frames[0].data.resources = { Buffer: 1 };
    assert.throws(
      () => compareReplays(a, b, { requireNativeParity: true }),
      /Native work|Resource ownership/,
    );
  }
});

test('configured fixed captures require complete host clocks and cannot shed the scope marker', () => {
  const c = settings(false);
  delete c.rounds[0].steps[0].drawingBufferHost;
  assert.throws(() => qualifyDrawingBuffer(c), /host clocks/);
  const d = settings(false);
  delete d.preserveDrawingBuffer;
  delete d.drawingBufferContext;
  delete d.drawingBufferContextAfter;
  assert.throws(
    () => qualifyDrawingBuffer(d),
    /Unlabelled drawing-buffer host/,
  );
});

test('drawing-buffer experiment requires restored creation interception', () => {
  for (const mutate of [
    (c) => (c.drawingBufferContext.overrideRestored = false),
    (c) => delete c.drawingBufferContext.overrideAttempts,
  ]) {
    const c = settings(false);
    mutate(c);
    assert.throws(() => qualifyDrawingBuffer(c));
  }
});

test('effective policy and probe state must remain identical after measured windows', () => {
  for (const mutate of [
    (c) => delete c.drawingBufferContextAfter,
    (c) =>
      (c.drawingBufferContextAfter.attributes.preserveDrawingBuffer = true),
  ]) {
    const c = settings(false);
    mutate(c);
    assert.throws(() => qualifyDrawingBuffer(c), /during capture/);
  }
});
