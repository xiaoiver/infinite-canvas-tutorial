import { createCanvas } from 'canvas';
import { Path, Rect, DOMAdapter } from '../../packages/core/src';
import { BatchManager } from '../../packages/core/src/drawcalls/BatchManager';
import { Drawcall } from '../../packages/core/src/drawcalls/Drawcall';
import { Mesh } from '../../packages/core/src/drawcalls/Mesh';
import { PathInstances } from '../../packages/core/src/drawcalls/PathInstances';
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

function planned(nodes: Path[]) {
  const canvas = jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockImplementation(
      (width = 1, height = 1) => createCanvas(width, height) as any,
    );
  const manager = new BatchManager(null);
  const calls: { ctor: unknown; shapes: Path[] }[] = [];
  const submit = jest
    .spyOn(Drawcall.prototype, 'submit')
    .mockImplementation(function (this: Drawcall) {
      calls.push({
        ctor: this.constructor,
        shapes: [...this.shapes] as Path[],
      });
    });
  try {
    manager.clear(true, true, false, true);
    nodes.forEach((node) => manager.add(node));
    manager.flush({} as any, {} as any, {});
    return calls;
  } finally {
    manager.destroy();
    submit.mockRestore();
    canvas.mockRestore();
  }
}

it('checks each stroke material once while enforcing 256-member pages and fresh styles', () => {
  const nodes = Array.from({ length: 300 }, path);
  const stroke = jest.spyOn(StrokeBatch, 'batchKey');
  const fill = jest.spyOn(PathInstances, 'batchKey');
  try {
    expect(planned(nodes).map((p) => [p.ctor, p.shapes.length])).toEqual([
      [StrokeBatch, 256],
      [StrokeBatch, 44],
    ]);
    expect(stroke).toHaveBeenCalledTimes(300);
    expect(fill).not.toHaveBeenCalled();
    stroke.mockClear();
    nodes[0].strokeWidth = 4;
    expect(planned(nodes).map((p) => [p.ctor, p.shapes.length])).toEqual([
      [StrokeBatch, 1],
      [StrokeBatch, 256],
      [StrokeBatch, 43],
    ]);
    expect(stroke).toHaveBeenCalledTimes(300);
  } finally {
    stroke.mockRestore();
    fill.mockRestore();
  }
});

it.each([
  { fill: 'none', stroke: '#123456', strokeWidth: 3 },
  { fill: 'blue', stroke: 'none', strokeWidth: 3 },
  { fill: 'blue', stroke: '#123456', strokeWidth: 0 },
  { fill: 'blue', stroke: '#123456', strokeWidth: -1 },
  { fill: 'blue', stroke: '#123456', strokeWidth: NaN },
  { fill: 'blue', stroke: '#123456', strokeWidth: Infinity },
  { fill: 'blue', stroke: '#123456', strokeWidth: 3 },
  { fill: 'none', stroke: 'none', strokeWidth: 3 },
  { fill: 'none', stroke: '#123456', strokeWidth: 0 },
  { fill: 'none', stroke: '#123456', strokeWidth: -1 },
  { fill: 'none', stroke: '#123456', strokeWidth: NaN },
  { fill: 'none', stroke: '#123456', strokeWidth: Infinity },

  { fill: 'none', stroke: '#123456', strokeWidth: 3, wireframe: true },
])(
  'keeps the original full eligibility predicates as the oracle for %p',
  (options) => {
    const node = new Path({ d: 'M0 0 H20 V20 Z', batchable: true, ...options });
    const expected =
      PathInstances.batchKey(node) !== null
        ? PathInstances
        : StrokeBatch.batchKey(node) !== null
        ? StrokeBatch
        : undefined;
    // Fill instancing deliberately keeps a singleton on the full Mesh path.
    if (expected === PathInstances)
      expect(planned([node]).map((c) => c.ctor)).toEqual([Mesh]);
    const duplicate = new Path({
      d: 'M0 0 H20 V20 Z',
      batchable: true,
      ...options,
    });
    const calls = planned([node, duplicate]);
    if (expected) expect(calls.map((c) => c.ctor)).toEqual([expected]);
    else
      expect(
        calls.every((c) => c.ctor !== PathInstances && c.ctor !== StrokeBatch),
      ).toBe(true);
  },
);
