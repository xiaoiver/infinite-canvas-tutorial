import assert from 'node:assert/strict';
export function strokeTextureMode(env = process.env) {
  const v = env.STROKE_TEXTURE_BENCH;
  assert(
    v === undefined || v === '0' || v === '1',
    'STROKE_TEXTURE_BENCH must be 0, 1 or unset',
  );
  assert(
    v === undefined ||
      (!env.STROKE_UPLOAD_DIAGNOSTIC &&
        !env.CAMERA_PHASES &&
        !env.CAMERA_TIMELINE_DIR),
    'Texture comparison must run separately from diagnostics/phases/timelines',
  );
  return v === undefined ? undefined : v === '1';
}
/** Extra native observers form their own ordinary timing cohort. */
export function sameStrokeTextureScope(a, b) {
  assert.equal(
    a.strokeTexture !== undefined,
    b.strokeTexture !== undefined,
    'Native texture counter scopes differ',
  );
}
export function qualifyStrokeTexture(capture) {
  const groups = capture.rounds ? [capture] : capture.results;
  for (const group of groups) {
    const frames = group.rounds.flatMap((r) =>
      r.steps.flatMap((s) => s.frames),
    );
    if (capture.strokeTexture === undefined) {
      assert.equal(
        group.textureProbeRestored,
        undefined,
        'Missing texture comparison marker',
      );
      assert(
        frames.every((f) => f.data.textureNative === undefined),
        'Missing texture comparison marker',
      );
      continue;
    }
    assert.equal(typeof capture.strokeTexture, 'boolean');
    assert.equal(
      group.textureProbeRestored,
      true,
      'Texture native observer not restored',
    );
    for (const f of frames) {
      const t = f.data.textureNative;
      assert(
        t &&
          [
            'creates',
            'deletes',
            'uploads',
            'typedBytes',
            'domUploads',
            'offsetUploads',
            'rgba32fBytesPeak',
            'rgba32fBytesLive',
          ].every((k) => Number.isSafeInteger(t[k]) && t[k] >= 0),
        'Missing native texture counters',
      );
      assert(t.rgba32fBytesPeak >= t.rgba32fBytesLive);
    }
    if (capture.strokeTexture)
      assert(
        frames.some((f) => f.data.textureNative.rgba32fBytesLive > 0),
        'Texture rendering did not activate',
      );
    if (capture.strokeTexture)
      assert(
        frames.some((f) => f.data.strokeTexturePages > 0),
        'Resident stroke draws missing',
      );
    else
      assert(
        frames.every((f) => (f.data.strokeTexturePages ?? 0) === 0),
        'Packed control entered texture rendering',
      );
  }
}
