import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorkflowInputCapture } from './helpers/workflow-input-fixture.mjs';
import {
  COMPOSITION_CONDITIONS,
  workflowCompositionMode,
} from '../../scripts/workflow-composition-tools.mjs';
import {
  compareWorkflowInputs,
  compareWorkflowCompositions,
  summarizeWorkflowComposition,
} from '../../scripts/workflow-input-tools.mjs';
import { continuousTimelineMode } from '../../scripts/continuous-timeline-tools.mjs';
function capture(condition = 'normal') {
  const c = makeWorkflowInputCapture();
  const before = {
    styleTags: 0,
    hitTarget: 'canvas',
    surface: {
      x: 300,
      y: 50,
      width: 1148,
      height: 914,
      bufferWidth: 1148,
      bufferHeight: 914,
    },
    canvas: {
      opacity: '1',
      visibility: 'visible',
      display: 'block',
      pointerEvents: 'auto',
      transform: 'none',
      inlineStyle: null,
    },
    overlay: {
      backdropFilter: 'blur(12px)',
      opacity: '1',
      visibility: 'visible',
      display: 'block',
      inlineStyle: null,
    },
  };
  const during = structuredClone(before);
  during.styleTags = 1;
  if (condition.includes('flat')) during.overlay.backdropFilter = 'none';
  if (condition.includes('transparent')) during.canvas.opacity = '0';
  c.mode = 'workflow-composition-diagnostic';
  c.composition = {
    scope: 'css-only',
    condition,
    before,
    during,
    after: structuredClone(before),
    restored: true,
    graphics: {
      renderer: 'test',
      version: 'test',
      shadingLanguageVersion: 'test',
      attributes: { alpha: true },
    },
  };
  for (const round of c.rounds) {
    round.compositionBefore = structuredClone(during);
    round.compositionAfter = structuredClone(during);
    for (const [i, s] of round.steps.entries())
      s.compositionHost = {
        dispatchedAt: i * 10,
        acknowledgedAt: i * 10 + 1,
        resultObservedAt: i * 10 + 4,
      };
  }
  return c;
}
test('composition conditions are explicit, isolated and refused by continuous mode', () => {
  assert.equal(workflowCompositionMode({}), undefined);
  for (const condition of COMPOSITION_CONDITIONS) {
    assert.equal(
      workflowCompositionMode({ WORKFLOW_COMPOSITION_CONDITION: condition }),
      condition,
    );
    assert.throws(() =>
      continuousTimelineMode({ WORKFLOW_COMPOSITION_CONDITION: condition }),
    );
  }
  assert.throws(() =>
    workflowCompositionMode({ WORKFLOW_COMPOSITION_CONDITION: '' }),
  );
  for (const key of [
    'CAMERA_PHASES',
    'CAMERA_TIMELINE_DIR',
    'CAMERA_TIMELINE_MODE',
    'STROKE_UPLOAD_DIAGNOSTIC',
    'STROKE_TEXTURE_BENCH',
  ])
    assert.throws(() =>
      workflowCompositionMode({
        WORKFLOW_COMPOSITION_CONDITION: 'normal',
        [key]: '0',
      }),
    );
});
test('four CSS conditions retain distinct summaries with exact camera/native/resource parity', () => {
  for (const condition of COMPOSITION_CONDITIONS) {
    const c = capture(condition),
      r = compareWorkflowCompositions(capture(), c);
    assert.equal(r.mode, 'workflow-composition-diagnostic');
    assert.equal(r.matchedSteps, 8);
    assert.deepEqual(r.conditions, ['normal', condition]);
    const s = summarizeWorkflowComposition(c);
    assert.equal(s.rounds[0].hostCommandToResultMs.p50, 4);
    assert.equal(s.rounds[0].hostAcknowledgementMs.p95, 1);
    assert.equal(s.rounds[0].engineWallMs.p50, 1);
  }
});
test('ordinary qualifier rejects CSS metadata and host clocks even after mode removal', () => {
  const c = capture();
  assert.throws(() => compareWorkflowInputs(c, c));
  delete c.mode;
  assert.throws(() => compareWorkflowInputs(c, c), /Composition/);
  delete c.composition;
  assert.throws(() => compareWorkflowInputs(c, c), /Composition host/);
  const normal = makeWorkflowInputCapture();
  assert.equal(compareWorkflowInputs(normal, normal).matchedSteps, 8);
});
for (const [name, mutate] of [
  ['unknown condition', (c) => (c.composition.condition = 'hidden')],
  ['unrestored stylesheet', (c) => (c.composition.restored = false)],
  ['changed final presentation', (c) => (c.composition.after.styleTags = 1)],
  ['wrong input target', (c) => (c.composition.during.hitTarget = 'overlay')],
  ['changed canvas size', (c) => c.composition.during.surface.width++],
  ['hidden canvas', (c) => (c.composition.during.canvas.visibility = 'hidden')],
  [
    'skipped blur ablation',
    (c) => (c.composition.during.overlay.backdropFilter = 'blur(12px)'),
  ],
  [
    'overlay changed during input',
    (c) => (c.rounds[1].compositionAfter.overlay.opacity = '0'),
  ],
  ['missing host clocks', (c) => delete c.rounds[0].steps[0].compositionHost],
  [
    'host order',
    (c) => (c.rounds[0].steps[1].compositionHost.dispatchedAt = 0),
  ],
  [
    'host acknowledgement',
    (c) => (c.rounds[0].steps[0].compositionHost.acknowledgedAt = 5),
  ],
  ['missing graphics identity', (c) => delete c.composition.graphics.renderer],
  ['different source', (c) => (c.source.tree = 'c'.repeat(40))],
  ['different GPU', (c) => (c.composition.graphics.renderer = 'other')],
  ['dirty source', (c) => (c.source.dirty = true)],
  [
    'less native drawing',
    (c) => c.rounds[0].steps[0].frames[0].data.native.indices--,
  ],
  [
    'changed membership',
    (c) => (c.rounds[0].steps[0].frames[0].data.visibleIds[0] = 'node-2'),
  ],
  ['GPU error', (c) => (c.rounds[0].validationAfter.errors = [1280])],
  ['document mutation', (c) => (c.documentSame = false)],
  ['pending teardown', (c) => (c.teardown = 'pending')],
])
  test(`rejects composition ${name}`, () => {
    const c = capture('flat-overlay');
    mutate(c);
    assert.throws(() => compareWorkflowCompositions(capture(), c));
  });
