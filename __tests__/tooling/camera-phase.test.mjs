import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraPhaseMode,
  sumCameraPhases,
} from '../../scripts/camera-phase-tools.mjs';
test('phase capture requires explicit opt-in and a separate instrumentation run', () => {
  assert.equal(cameraPhaseMode({}), false);
  assert.equal(cameraPhaseMode({ CAMERA_PHASES: '1' }), true);
  assert.equal(cameraPhaseMode({ CAMERA_TIMELINE_DIR: 'out' }), false);
  for (const value of ['0', '', 'true', '2'])
    assert.throws(
      () => cameraPhaseMode({ CAMERA_PHASES: value }),
      /CAMERA_PHASES/,
    );
  assert.throws(
    () => cameraPhaseMode({ CAMERA_PHASES: '1', CAMERA_TIMELINE_DIR: 'out' }),
    /separately/,
  );
});

const frames = () => [
  {
    elapsed: 12,
    data: {
      phaseDetail: 'camera',
      phases: {
        parent: { calls: 1, inclusiveMs: 10, exclusiveMs: 4 },
        child: { calls: 2, inclusiveMs: 6, exclusiveMs: 6 },
      },
    },
  },
];
test('aggregates exclusive scopes once and retains inclusive nesting and counts', () => {
  const result = sumCameraPhases([...frames(), ...frames()]);
  assert.equal(result.frames, 2);
  assert.equal(result.engineTotalMs, 24);
  assert.equal(result.measuredExclusiveMs, 20);
  assert.deepEqual(result.phases.child, {
    calls: 4,
    inclusiveMs: 12,
    exclusiveMs: 12,
  });
  assert.deepEqual(result.phases.parent, {
    calls: 2,
    inclusiveMs: 20,
    exclusiveMs: 8,
  });
});
for (const [name, mutate] of [
  ['unmarked data', (f) => delete f[0].data.phaseDetail],
  ['missing scopes', (f) => delete f[0].data.phases],
  ['zero calls', (f) => (f[0].data.phases.parent.calls = 0)],
  ['nonfinite duration', (f) => (f[0].data.phases.child.inclusiveMs = NaN)],
  ['negative exclusive', (f) => (f[0].data.phases.child.exclusiveMs = -1)],
  [
    'exclusive above inclusive',
    (f) => (f[0].data.phases.child.exclusiveMs = 7),
  ],
  ['overlapping exclusive sums', (f) => (f[0].elapsed = 9)],
])
  test(`phase aggregation rejects ${name}`, () => {
    const f = frames();
    mutate(f);
    assert.throws(() => sumCameraPhases(f));
  });
