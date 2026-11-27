import assert from 'node:assert/strict';
/** Extra observers must never silently enter an ordinary/phase/timeline cohort. */
export function strokeUploadMode(env = process.env) {
  assert(
    env.STROKE_UPLOAD_DIAGNOSTIC === undefined ||
      env.STROKE_UPLOAD_DIAGNOSTIC === '1',
    'STROKE_UPLOAD_DIAGNOSTIC must be 1 or unset',
  );
  const enabled = env.STROKE_UPLOAD_DIAGNOSTIC === '1';
  assert(
    !enabled || (!env.CAMERA_PHASES && !env.CAMERA_TIMELINE_DIR),
    'Capture stroke uploads separately from phases/timelines',
  );
  return enabled;
}
export function summarizeStrokeUploads(capture) {
  assert.equal(
    capture.mode,
    'stroke-upload-diagnostic',
    'Explicit upload diagnostic required',
  );
  assert.equal(capture.source.dirty, false, 'Clean source required');
  const groups = capture.rounds
    ? [
        {
          backend: 'ecs',
          rounds: capture.rounds,
          documentSame: capture.documentSame,
          teardown: capture.teardown,
          uploadProbeRestored: capture.uploadProbeRestored,
        },
      ]
    : capture.results;
  return groups.flatMap((group) => {
    assert.equal(group.documentSame, true);
    assert.equal(group.teardown, 'passed');
    assert.equal(
      group.uploadProbeRestored,
      true,
      'Upload recorder not restored',
    );
    return group.rounds.map((round) => {
      const total = {};
      for (const step of round.steps) {
        const v = step.strokeUploads;
        assert(v?.loads > 0 && v.packModules > 0, 'Upload observer missing');
        for (const [k, x] of Object.entries(v)) {
          assert(Number.isSafeInteger(x) && x >= 0, 'Invalid upload counter');
          if (k !== 'loads' && k !== 'packModules')
            total[k] = k.endsWith('_peakBytes')
              ? Math.max(total[k] ?? 0, x)
              : (total[k] ?? 0) + x;
        }
      }
      for (const mb of [1, 4, 8]) {
        const k = `resident${mb}m_`;
        if (total[k + 'peakBytes'] !== undefined) {
          assert(total[k + 'peakBytes'] <= mb * 1024 * 1024);
          assert.equal(
            total[k + 'hits'] +
              total[k + 'misses'] +
              total[k + 'fallbackNodes'] +
              total[k + 'emptyNodes'],
            total.nodeSamples,
          );
        }
      }
      assert(total.packedCalls > 0, 'No stroke geometry observed');
      assert.equal(
        total.nodeSamples,
        total.firstNodes +
          total.unchangedGeometryNodes +
          total.changedGeometryNodes,
      );
      assert(total.unchangedPayloadBytes <= total.packedBytes);
      assert(total.unchangedGeometryBytes <= total.packedBytes);
      assert(
        total.spanUploadBytes <= total.capacityUploadBytes &&
          total.capacityUploadBytes <= total.packedBytes,
      );
      return { backend: group.backend, round: round.index, ...total };
    });
  });
}
