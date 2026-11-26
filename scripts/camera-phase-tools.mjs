import assert from 'node:assert/strict';
/** Never silently combine two kinds of instrumentation or label one as ordinary. */
export function cameraPhaseMode(env = process.env) {
  assert(
    env.CAMERA_PHASES === undefined || env.CAMERA_PHASES === '1',
    'CAMERA_PHASES must be 1 or unset',
  );
  assert(
    !env.CAMERA_PHASES || !env.CAMERA_TIMELINE_DIR,
    'Capture phases and CDP timelines separately',
  );
  return env.CAMERA_PHASES === '1';
}

/** Analyze only explicitly marked diagnostic frames; inclusive scopes can overlap. */
export function sumCameraPhases(frames) {
  assert(
    Array.isArray(frames) && frames.length > 0,
    'Completed phase frames required',
  );
  const totals = new Map();
  let engineTotalMs = 0,
    measuredExclusiveMs = 0;
  for (const frame of frames) {
    assert(
      Number.isFinite(frame.elapsed) && frame.elapsed >= 0,
      'Invalid engine duration',
    );
    assert.equal(
      frame.data.phaseDetail,
      'camera',
      'Explicit camera phase frame required',
    );
    const phases = frame.data.phases;
    assert(
      phases && typeof phases === 'object' && !Array.isArray(phases),
      'Phase timings required',
    );
    let exclusive = 0;
    for (const [name, timing] of Object.entries(phases)) {
      assert(
        name && Number.isSafeInteger(timing.calls) && timing.calls > 0,
        'Invalid phase calls',
      );
      assert(
        Number.isFinite(timing.inclusiveMs) &&
          timing.inclusiveMs >= 0 &&
          Number.isFinite(timing.exclusiveMs) &&
          timing.exclusiveMs >= -1e-6 &&
          timing.exclusiveMs <= timing.inclusiveMs + 1e-6,
        'Invalid phase duration',
      );
      const total = totals.get(name) ?? {
        calls: 0,
        inclusiveMs: 0,
        exclusiveMs: 0,
      };
      for (const key of ['calls', 'inclusiveMs', 'exclusiveMs'])
        total[key] += timing[key];
      totals.set(name, total);
      exclusive += timing.exclusiveMs;
    }
    assert(
      exclusive <= frame.elapsed + 1e-3,
      'Exclusive scopes exceed the engine window',
    );
    engineTotalMs += frame.elapsed;
    measuredExclusiveMs += exclusive;
  }
  return {
    frames: frames.length,
    engineTotalMs,
    measuredExclusiveMs,
    phases: Object.fromEntries(
      [...totals].sort((a, b) => b[1].exclusiveMs - a[1].exclusiveMs),
    ),
  };
}
