import test from 'node:test';
import assert from 'node:assert/strict';
import { strokeTextureMode } from '../../scripts/stroke-texture-bench-tools.mjs';
test('texture comparison has explicit controls and rejects mixed diagnostic scopes', () => {
  assert.equal(strokeTextureMode({}), undefined);
  assert.equal(strokeTextureMode({ STROKE_TEXTURE_BENCH: '0' }), false);
  assert.equal(strokeTextureMode({ STROKE_TEXTURE_BENCH: '1' }), true);
  for (const v of ['', 'true', '2'])
    assert.throws(() => strokeTextureMode({ STROKE_TEXTURE_BENCH: v }));
  for (const k of [
    'STROKE_UPLOAD_DIAGNOSTIC',
    'CAMERA_PHASES',
    'CAMERA_TIMELINE_DIR',
  ])
    assert.throws(() =>
      strokeTextureMode({ STROKE_TEXTURE_BENCH: '1', [k]: '1' }),
    );
});
import {
  sameStrokeTextureScope,
  qualifyStrokeTexture,
} from '../../scripts/stroke-texture-bench-tools.mjs';
test('texture native scopes require restoration and cannot be compared to unobserved timing', () => {
  const make = (enabled) => ({
    strokeTexture: enabled,
    textureProbeRestored: true,
    rounds: [
      {
        steps: [
          {
            frames: [
              {
                data: {
                  strokeTexturePages: enabled ? 1 : 0,
                  textureNative: {
                    creates: 0,
                    deletes: 0,
                    uploads: 1,
                    typedBytes: 16,
                    domUploads: 0,
                    offsetUploads: 0,
                    rgba32fBytesPeak: 32,
                    rgba32fBytesLive: enabled ? 16 : 0,
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  });
  const a = make(false),
    b = make(true);
  qualifyStrokeTexture(a);
  qualifyStrokeTexture(b);
  sameStrokeTextureScope(a, b);
  assert.throws(() => sameStrokeTextureScope(a, {}), /scopes differ/);
  for (const mutate of [
    (x) => (x.textureProbeRestored = false),
    (x) => delete x.strokeTexture,
    (x) => (x.rounds[0].steps[0].frames[0].data.textureNative.typedBytes = -1),
  ]) {
    const x = make(true);
    mutate(x);
    assert.throws(() => qualifyStrokeTexture(x));
  }
});

import { cameraTraceHash } from '../../scripts/camera-replay-tools.mjs';
import {
  compareStrokeTextures,
  summarizeStrokeTextures,
} from '../../scripts/stroke-texture-comparison.mjs';
const experiment = (enabled) => {
  const trace = [{ id: 'one', x: 0, y: 0, zoom: 1 }],
    viewport = { width: 800, height: 600, dpr: 1 };
  return {
    schema: 1,
    workload: 'strokes',
    source: { dirty: false, head: 'a'.repeat(40), tree: 'b'.repeat(40) },
    browser: 'test',
    node: 'test',
    trace,
    viewport,
    traceHash: cameraTraceHash('strokes', trace, viewport),
    strokeTexture: enabled,
    results: [
      {
        backend: 'core',
        mode: 'scoped',
        documentSame: true,
        teardown: 'passed',
        textureProbeRestored: true,
        rounds: [0, 1].map((index) => ({
          index,
          steps: [
            {
              id: 'one',
              requested: { x: 0, y: 0, zoom: 1 },
              operationToFrameMs: 3,
              operationToResultMs: 4,
              frames: [
                {
                  view: { x: 0, y: 0, zoom: 1 },
                  startedAt: 10,
                  elapsed: 1,
                  completedAt: 11,
                  observedAt: 12,
                  observationMs: 1,
                  data: {
                    surface: {
                      width: 800,
                      height: 600,
                      bufferWidth: 800,
                      bufferHeight: 600,
                      dpr: 1,
                    },
                    visibleIndices: [0, 1],
                    visible: 2,
                    strokePages: 1,
                    strokeTexturePages: enabled ? 1 : 0,
                    native: {
                      bufferCreates: 1,
                      bufferDeletes: 0,
                      bufferAllocations: 1,
                      bufferUploads: 2,
                      bufferBytes: 64,
                      uniformUploads: 1,
                      uniformBytes: 16,
                      drawcalls: 2,
                      indices: 30,
                      arrayVertices: 4,
                    },
                    textureNative: {
                      creates: 0,
                      deletes: 0,
                      uploads: 1,
                      typedBytes: 24,
                      domUploads: 0,
                      offsetUploads: 0,
                      rgba32fBytesPeak: enabled ? 64 : 0,
                      rgba32fBytesLive: enabled ? 32 : 0,
                    },
                    cpu: {
                      precisionCalls: 1,
                      precisionMs: 1,
                      geometryCalls: 0,
                      geometryMs: 0,
                    },
                    phases: {
                      plan: { calls: 1, inclusiveMs: 1, exclusiveMs: 1 },
                    },
                    resources: [
                      {
                        side: 'canvas',
                        live: {
                          Buffer: enabled ? 1 : 2,
                          Texture: enabled ? 2 : 1,
                          Framebuffer: 1,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        })),
      },
    ],
  };
};
const frame = (c) => c.results[0].rounds[0].steps[0].frames[0];
test('strict texture comparison preserves semantic, uniform, geometry-call and draw work', () => {
  const a = experiment(false),
    b = experiment(true);
  // Different CPU/phase duration is an outcome; call counts remain comparable.
  frame(b).data.cpu.precisionMs = 9;
  frame(b).data.phases.plan.inclusiveMs = 9;
  assert.equal(compareStrokeTextures(a, b).matchedFrames, 2);
  for (const mutate of [
    (x) => (x.source.head = 'c'.repeat(40)),
    (x) => (x.source.dirty = true),
    (x) => frame(x).data.native.indices++,
    (x) => frame(x).data.native.uniformBytes++,
    (x) => (frame(x).data.visibleIndices[0] = 2),
    (x) => frame(x).data.cpu.precisionCalls++,
    (x) => frame(x).data.phases.plan.calls++,
    (x) => frame(x).data.resources[0].live.Framebuffer++,
    (x) => delete frame(x).data.native.bufferBytes,
    (x) => (x.results[0].teardown = 'pending'),
    (x) => (x.results[0].textureProbeRestored = false),
  ]) {
    const x = experiment(true);
    mutate(x);
    assert.throws(() => compareStrokeTextures(a, x));
  }
});
test('repeat comparison detects allocation, storage, and texture work drift', () => {
  const a = experiment(true);
  compareStrokeTextures(a, structuredClone(a), { repeat: true });
  for (const mutate of [
    (x) => frame(x).data.native.bufferCreates++,
    (x) => frame(x).data.textureNative.typedBytes++,
    (x) => frame(x).data.textureNative.rgba32fBytesPeak++,
    (x) => frame(x).data.resources[0].live.Buffer++,
  ]) {
    const b = structuredClone(a);
    mutate(b);
    assert.throws(() => compareStrokeTextures(a, b, { repeat: true }));
  }
  assert.throws(() =>
    compareStrokeTextures(experiment(false), a, { repeat: true }),
  );
});
test('summary includes uniform buffer bytes once, preserves unknown transfers and takes maximum storage peak', () => {
  const c = experiment(true),
    r = c.results[0].rounds[0],
    s = structuredClone(r.steps[0]);
  s.id = 'two';
  s.frames[0].data.textureNative.rgba32fBytesPeak = 96;
  c.trace.push({ ...c.trace[0], id: 'two' });
  c.traceHash = cameraTraceHash(c.workload, c.trace, c.viewport);
  r.steps.push(s);
  c.results[0].rounds[1].steps.push(structuredClone(s));
  const summary = summarizeStrokeTextures(c)[0];
  assert.equal(summary.knownTransferBytes, 176); // 2 * (64 buffer incl. uniform + 24 texture)
  assert.equal(summary.totalTransferBytes, 176);
  assert.equal(summary.floatPeak, 96); // Not 64 + 96.
  frame(c).data.textureNative.domUploads = 1;
  assert.equal(summarizeStrokeTextures(c)[0].totalTransferBytes, undefined);
  frame(c).data.textureNative.domUploads = 0;
  frame(c).data.textureNative.offsetUploads = 1;
  assert.equal(summarizeStrokeTextures(c)[0].totalTransferBytes, undefined);
});
