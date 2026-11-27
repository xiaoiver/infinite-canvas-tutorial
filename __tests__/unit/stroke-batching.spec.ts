import { createCanvas } from 'canvas';
import { DOMAdapter, Path, Rect } from '../../packages/core/src';
import { StrokeBatch } from '../../packages/core/src/drawcalls/StrokeBatch';
import * as packing from '../../packages/core/src/utils/stroke-batching';
import { strokePackingContract } from '../contracts/stroke-batching';

strokePackingContract(packing, 1);
const path = () =>
  new Path({
    d: 'M0 0C10 -20 20 30 30 0',
    fill: 'none',
    stroke: '#123456',
    strokeWidth: 3,
    batchable: true,
  });
it('keys paint/geometry policy while permitting different translated curves', () => {
  const a = path(),
    b = path();
  b.d = 'M0 0L40 20';
  b.worldTransform.tx = 100;
  expect(StrokeBatch.batchKey(a)).not.toBeNull();
  expect(StrokeBatch.batchKey(b)).toBe(StrokeBatch.batchKey(a));
  b.strokeWidth = 4;
  expect(StrokeBatch.batchKey(b)).not.toBe(StrokeBatch.batchKey(a));
  b.worldTransform.a = 2;
  expect(StrokeBatch.batchKey(b)).toBeNull();
  expect(StrokeBatch.batchKey(new Rect())).toBeNull();
});
it.each([
  { fill: 'red' },
  { strokeDasharray: [4, 2] },
  { wireframe: true },
  { sizeAttenuation: true },
  { strokeWidth: 0 },
  { batchable: false },
  { dropShadowBlurRadius: 4 },
  { stroke: 'none' },
])('falls back for unsupported stroke state %p', (change) => {
  const p = path();
  Object.assign(p, change);
  expect(StrokeBatch.batchKey(p)).toBeNull();
});

it('keys the actual uploaded color, including direct color mutations', () => {
  const a = path(),
    b = path();
  b.stroke = 'rgb(18, 52, 86)';
  expect(StrokeBatch.batchKey(a)).toBe(StrokeBatch.batchKey(b));
  b.strokeRGB.r = 17;
  expect(StrokeBatch.batchKey(a)).not.toBe(StrokeBatch.batchKey(b));
});

import { SmoothPolyline } from '../../packages/core/src/drawcalls/SmoothPolyline';
import { strokeReuseContract } from '../contracts/stroke-reuse';
strokeReuseContract(
  path,
  (shape, d) => {
    shape.d = d;
  },
  (device, full) =>
    new (full ? SmoothPolyline : StrokeBatch)(device, null, null, false, 0),
);

import { PathGeometryCache } from '../../packages/core/src/utils/path-rendering';
import { strokePrecisionContextContract } from '../contracts/stroke-reuse';
strokePrecisionContextContract(PathGeometryCache);

import {
  strokeSegmentCacheContract,
  strokeSegmentReuseContract,
} from '../contracts/stroke-reuse';
strokeSegmentCacheContract(packing.StrokeSegmentCache);
strokeSegmentReuseContract(
  path,
  (shape, d) => {
    shape.d = d;
  },
  (shape, cap, join) => {
    shape.strokeLinecap = cap;
    shape.strokeLinejoin = join;
  },
  (shape) => {
    shape.worldTransform.tx = 91;
    shape.worldTransform.ty = -30;
    shape.globalRenderOrder = 42;
  },
  (device, full) =>
    new (full ? SmoothPolyline : StrokeBatch)(device, null, null, false, 0),
);

import { strokePageBuffersContract } from '../contracts/stroke-page-buffers';
strokePageBuffersContract(
  path,
  (device, full) =>
    new (full ? SmoothPolyline : StrokeBatch)(device, null, null, false, 0),
);

it.each([NaN, Infinity, -Infinity])(
  'rejects nonfinite key inputs and sees their restoration (%p)',
  (invalid) => {
    const p = path(),
      key = StrokeBatch.batchKey(p);
    const fields: [any, string][] = [
      ...['tx', 'ty'].map((k) => [p.worldTransform, k] as [any, string]),
      ...['r', 'g', 'b', 'opacity'].map(
        (k) => [p.strokeRGB, k] as [any, string],
      ),
      ...[
        'strokeWidth',
        'strokeMiterlimit',
        'strokeDashoffset',
        'opacity',
        'strokeOpacity',
      ].map((k) => [p, k] as [any, string]),
    ];
    expect(key).not.toBeNull();
    for (const [object, field] of fields) {
      const value = object[field];
      object[field] = invalid;
      expect({ field, key: StrokeBatch.batchKey(p) }).toEqual({
        field,
        key: null,
      });
      object[field] = value;
      expect(StrokeBatch.batchKey(p)).toBe(key);
    }
  },
);
it('keeps finite extreme/negative-zero translations out of material identity', () => {
  const p = path(),
    key = StrokeBatch.batchKey(p);
  for (const value of [
    -0,
    Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER,
    Number.EPSILON,
  ]) {
    p.worldTransform.tx = value;
    p.worldTransform.ty = -value;
    expect(StrokeBatch.batchKey(p)).toBe(key);
  }
});

import { BatchManager } from '../../packages/core/src/drawcalls/BatchManager';
it('reclassifies raw mutable colors when visible membership changes', () => {
  const canvas = jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockImplementation(
      (width = 1, height = 1) => createCanvas(width, height) as any,
    );
  const batch = new BatchManager(null);
  const a = path(),
    b = path(),
    c = path();
  const frame = (shapes: Path[]) => {
    batch.clear(true, true);
    shapes.forEach((shape) => batch.add(shape));
    (batch as any).planOrdered();
  };
  try {
    frame([a, b, c]);
    expect(batch.stats().drawcallCount).toBe(1);
    for (const shape of [a, b, c]) {
      shape.renderDirtyFlag = false;
      shape.geometryDirtyFlag = false;
      shape.materialDirtyFlag = false;
    }
    a.strokeRGB.r = 17;
    frame([a, b]);
    expect(batch.stats().drawcallCount).toBe(2);
    expect(StrokeBatch.batchKey(a)).not.toBe(StrokeBatch.batchKey(b));
    a.strokeRGB.r = b.strokeRGB.r;
    frame([a, b, c]);
    expect(batch.stats().drawcallCount).toBe(1);
  } finally {
    batch.destroy();
    canvas.mockRestore();
  }
});
