import assert from 'node:assert/strict';
export const COMPOSITION_CONDITIONS = [
  'normal',
  'flat-overlay',
  'transparent-canvas',
  'flat-transparent',
];
/** CSS ablations are a separate cohort, never a profiling or ordinary capture. */
export function workflowCompositionMode(env = process.env) {
  const condition = env.WORKFLOW_COMPOSITION_CONDITION;
  if (condition === undefined) return;
  assert(
    COMPOSITION_CONDITIONS.includes(condition),
    'Unknown composition condition',
  );
  for (const key of [
    'CAMERA_PHASES',
    'CAMERA_TIMELINE_DIR',
    'CAMERA_TIMELINE_MODE',
    'STROKE_UPLOAD_DIAGNOSTIC',
    'STROKE_TEXTURE_BENCH',
  ])
    assert(
      env[key] === undefined,
      'Composition conditions require a separate capture',
    );
  return condition;
}
export function qualifyCompositionState(composition) {
  const { condition, before, during, after } = composition;
  assert(
    COMPOSITION_CONDITIONS.includes(condition),
    'Unknown composition condition',
  );
  assert.equal(composition.scope, 'css-only');
  assert.equal(
    composition.restored,
    true,
    'Composition stylesheet not restored',
  );
  assert.deepEqual(after, before, 'Original presentation not restored');
  assert.equal(before.styleTags, 0, 'Existing composition stylesheet');
  assert.equal(before.hitTarget, 'canvas', 'Canvas is not the input target');
  assert.equal(
    before.canvas.opacity,
    '1',
    'Control canvas must be opaque in CSS',
  );
  assert.equal(before.canvas.visibility, 'visible');
  assert.notEqual(before.canvas.display, 'none');
  assert.match(
    before.overlay.backdropFilter,
    /^blur\([1-9][\d.]*px\)$/,
    'Control overlay must have an active backdrop blur',
  );
  const expected = structuredClone(before);
  expected.styleTags = 1;
  if (condition.includes('flat')) expected.overlay.backdropFilter = 'none';
  if (condition.includes('transparent')) expected.canvas.opacity = '0';
  assert.deepEqual(
    during,
    expected,
    'Composition condition changed other presentation/input geometry',
  );
  for (const k of ['renderer', 'version', 'shadingLanguageVersion'])
    assert(
      typeof composition.graphics?.[k] === 'string' && composition.graphics[k],
      'Missing graphics identity',
    );
  assert(
    composition.graphics.attributes &&
      typeof composition.graphics.attributes === 'object',
    'Missing context attributes',
  );
}
export function qualifyWorkflowComposition(capture) {
  assert.equal(
    capture.preserveDrawingBuffer,
    undefined,
    'CSS and context captures must stay separate',
  );
  assert.equal(
    capture.drawingBufferContext,
    undefined,
    'CSS and context captures must stay separate',
  );
  assert.equal(capture.mode, 'workflow-composition-diagnostic');
  assert(capture.composition, 'Missing composition metadata');
  qualifyCompositionState(capture.composition);
  for (const round of capture.rounds) {
    assert.deepEqual(
      round.compositionBefore,
      capture.composition.during,
      'Composition changed before traversal',
    );
    assert.deepEqual(
      round.compositionAfter,
      capture.composition.during,
      'Composition changed during traversal',
    );
    let previous = -Infinity;
    for (const step of round.steps) {
      const h = step.compositionHost;
      assert(
        h &&
          ['dispatchedAt', 'acknowledgedAt', 'resultObservedAt'].every(
            (k) => Number.isFinite(h[k]) && h[k] >= 0,
          ),
        'Missing host command clocks',
      );
      assert(
        h.dispatchedAt >= previous &&
          h.acknowledgedAt >= h.dispatchedAt &&
          h.resultObservedAt >= h.acknowledgedAt,
        'Host command clock order differs',
      );
      previous = h.resultObservedAt;
    }
  }
}
