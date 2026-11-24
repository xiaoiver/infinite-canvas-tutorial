import { Path, Rect } from '../../packages/core/src';
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
