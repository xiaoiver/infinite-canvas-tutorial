import assert from 'node:assert/strict';
/** Initialization setting cohort. Keep profiler/CSS/texture observers separate. */
export function drawingBufferMode(env = process.env) {
  const value = env.DRAWING_BUFFER_PRESERVE;
  if (value === undefined) return;
  assert(
    value === '0' || value === '1',
    'DRAWING_BUFFER_PRESERVE must be 0, 1 or unset',
  );
  for (const key of [
    'WORKFLOW_COMPOSITION_CONDITION',
    'CAMERA_PHASES',
    'CAMERA_TIMELINE_DIR',
    'CAMERA_TIMELINE_MODE',
    'STROKE_UPLOAD_DIAGNOSTIC',
    'STROKE_TEXTURE_BENCH',
  ])
    assert(
      env[key] === undefined,
      'Drawing-buffer settings require a separate capture',
    );
  return value === '1';
}
const groups = (c) => c.results ?? [c];
export function qualifyDrawingBuffer(capture) {
  const requested = capture.preserveDrawingBuffer;
  if (requested !== undefined) {
    assert.equal(typeof requested, 'boolean', 'Invalid drawing-buffer request');
    assert(
      Array.isArray(groups(capture)) && groups(capture).length > 0,
      'Missing drawing-buffer settings groups',
    );
  }
  for (const group of groups(capture)) {
    const context = group.drawingBufferContext;
    if (requested === undefined) {
      assert.equal(context, undefined, 'Unlabelled drawing-buffer context');
      assert.equal(
        group.drawingBufferContextAfter,
        undefined,
        'Unlabelled drawing-buffer final context',
      );
      for (const round of group.rounds ?? [])
        for (const step of round.steps)
          assert.equal(
            step.drawingBufferHost,
            undefined,
            'Unlabelled drawing-buffer host clocks',
          );
      continue;
    }
    for (const round of group.rounds ?? []) {
      let previous = -Infinity;
      for (const step of round.steps) {
        const h = step.drawingBufferHost;
        assert(
          h &&
            Number.isFinite(h.dispatchedAt) &&
            h.dispatchedAt >= 0 &&
            Number.isFinite(h.resultObservedAt) &&
            h.resultObservedAt >= h.dispatchedAt &&
            h.dispatchedAt >= previous,
          'Invalid/missing drawing-buffer host clocks',
        );
        previous = h.resultObservedAt;
      }
    }
    assert.equal(typeof requested, 'boolean', 'Invalid drawing-buffer request');
    assert(
      context && ['webgl', 'webgl2'].includes(context.api),
      'Missing drawing-buffer context',
    );
    assert.equal(
      context.overrideRestored,
      true,
      'Drawing-buffer creation override not restored',
    );
    assert(
      Number.isSafeInteger(context.overrideAttempts) &&
        context.overrideAttempts > 0,
      'Missing context-creation witness',
    );
    for (const k of ['renderer', 'version', 'shadingLanguageVersion'])
      assert(
        typeof context[k] === 'string' && context[k],
        'Missing graphics identity',
      );
    assert.equal(
      context.attributes?.preserveDrawingBuffer,
      requested,
      'Actual drawing-buffer policy differs',
    );
    assert.deepEqual(
      group.drawingBufferContextAfter,
      context,
      'Drawing-buffer context changed during capture',
    );
  }
}
export function sameDrawingBufferScope(a, b) {
  qualifyDrawingBuffer(a);
  qualifyDrawingBuffer(b);
  assert.equal(
    a.preserveDrawingBuffer !== undefined,
    b.preserveDrawingBuffer !== undefined,
    'Drawing-buffer scopes differ',
  );
  if (a.preserveDrawingBuffer === undefined) return;
  const identity = (c) =>
    groups(c).map((group) => {
      const { drawingBufferContext: context } = group,
        attributes = { ...context.attributes };
      delete attributes.preserveDrawingBuffer;
      return { backend: group.backend ?? 'workflow', ...context, attributes };
    });
  assert.deepEqual(
    identity(a),
    identity(b),
    'Graphics identity/context attributes differ beyond drawing-buffer policy',
  );
}
export function drawingBufferSummary(capture) {
  return capture.preserveDrawingBuffer === undefined
    ? {}
    : {
        preserveDrawingBuffer: capture.preserveDrawingBuffer,
        drawingBufferContexts: groups(capture).map((g) => ({
          backend: g.backend ?? 'workflow',
          ...g.drawingBufferContext,
        })),
      };
}
