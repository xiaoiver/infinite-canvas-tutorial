import {
  API,
  type Entity,
  Path,
  Stroke,
  StrokeLayers,
  GlobalTransform,
  Mat3,
  Renderable,
  Rect,
  Marker,
  Filter,
  Children,
} from '../../packages/ecs/src';
import { StrokeBatch } from '../../packages/ecs/src/drawcalls/StrokeBatch';
import { Mesh } from '../../packages/ecs/src/drawcalls/Mesh';
import { SmoothPolyline } from '../../packages/ecs/src/drawcalls/SmoothPolyline';
import { BatchManager } from '../../packages/ecs/src/systems/BatchManager';
import * as packing from '../../packages/ecs/src/utils/stroke-batching';
import { strokePackingContract } from '../contracts/stroke-batching';

strokePackingContract(packing, 3);
function path() {
  const data = new Map<unknown, any>([
    [Path, { d: 'M0 0C10 -20 20 30 30 0' }],
    [Renderable, { batchable: true }],
    [
      Stroke,
      {
        width: 3,
        alignment: 'center',
        linecap: 'round',
        linejoin: 'round',
        miterlimit: 4,
        dashoffset: 0,
        dashcap: 'none',
        dasharray: { 0: 0, 1: 0 },
      },
    ],
    [StrokeLayers, { layers: [{ type: 'solid', value: '#123456' }] }],
    [GlobalTransform, { matrix: Mat3.copy(Mat3.IDENTITY) }],
  ]);
  const entity = {
    has: (c: unknown) => data.has(c),
    hasSomeOf: (...cs: unknown[]) => cs.some((c) => data.has(c)),
    read: (c: unknown) => {
      if (!data.has(c)) throw new Error('unexpected component');
      return data.get(c);
    },
  } as Entity;
  return { entity, data };
}
const managers: BatchManager[] = [];
function manager(intent: 'screen' | 'export' = 'screen') {
  const batch = new BatchManager(
    null,
    null,
    null,
    null,
    { getNodeByEntity: () => ({}) } as API,
    intent,
  );
  managers.push(batch);
  return batch;
}
const queued = (b: BatchManager) =>
  b.buildFlushSegments().flatMap((s) => s.drawcalls);
afterEach(() => managers.splice(0).forEach((b) => b.destroy()));
it('supports Becsy vector views and different translated geometry, with strict effect/arrow fallback', () => {
  const a = path(),
    b = path();
  b.data.get(Path).d = 'M0 0L40 20';
  b.data.get(GlobalTransform).matrix.m20 = 100;
  expect(StrokeBatch.batchKey(a.entity)).not.toBeNull();
  expect(StrokeBatch.batchKey(b.entity)).toBe(StrokeBatch.batchKey(a.entity));
  b.data.set(Marker, { start: 'none', end: 'none' });
  expect(StrokeBatch.batchKey(b.entity)).not.toBeNull();
  b.data.get(Marker).end = 'triangle';
  expect(StrokeBatch.batchKey(b.entity)).toBeNull();
  b.data.delete(Marker);
  b.data.get(Stroke).dasharray[1] = 2;
  expect(StrokeBatch.batchKey(b.entity)).toBeNull();
  b.data.get(Stroke).dasharray[1] = 0;
  b.data.get(GlobalTransform).matrix.m00 = 2;
  expect(StrokeBatch.batchKey(b.entity)).toBeNull();
});
it('defaults off, opts in on screen, respects barriers/ancestors and keeps export full', () => {
  const batch = manager(),
    a = path(),
    b = path();
  [a, b].forEach((n) => batch.add(n.entity));
  expect(queued(batch).map((d) => d.constructor)).toEqual([
    SmoothPolyline,
    SmoothPolyline,
  ]);
  batch.setPathInstancingEnabled(true);
  expect(queued(batch).map((d) => d.constructor)).toEqual([StrokeBatch]);
  const parent = path();
  parent.data.set(Filter, {});
  a.data.set(Children, { parent: parent.entity });
  batch.add(a.entity);
  expect(queued(batch).map((d) => d.constructor)).toEqual([
    Mesh,
    SmoothPolyline,
    StrokeBatch,
  ]);
  const exp = manager('export');
  exp.setPathInstancingEnabled(true);
  exp.add(b.entity);
  expect(queued(exp)[0]).toBeInstanceOf(SmoothPolyline);
  expect(queued(exp)[0]).not.toBeInstanceOf(StrokeBatch);
});
it('bounds pages, retires every empty style and never revives a queued deleted page', () => {
  const batch = manager();
  batch.setPathInstancingEnabled(true);
  const nodes = Array.from({ length: 300 }, path);
  nodes.forEach((n) => batch.add(n.entity));
  const pages = queued(batch);
  expect(pages.map((p) => p.shapes.length)).toEqual([256, 44]);
  const releases = pages.map((p) => jest.spyOn(p, 'destroy'));
  nodes.forEach((n) => batch.remove(n.entity, false));
  expect(queued(batch)).toEqual([]);
  releases.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
  expect(pages.every((p) => p.destroyed)).toBe(true);
  batch.add(nodes[0].entity);
  expect(queued(batch)[0]).not.toBe(pages[0]);
});

import { strokeReuseContract } from '../contracts/stroke-reuse';
strokeReuseContract(
  () => path().entity,
  (shape, d) => {
    shape.read(Path).d = d;
  },
  (device, full) =>
    new (full ? SmoothPolyline : StrokeBatch)(
      device,
      null,
      null,
      null,
      false,
      0,
      null,
    ),
);

import { PathGeometryCache } from '../../packages/ecs/src/utils/path-rendering';
import { strokePrecisionContextContract } from '../contracts/stroke-reuse';
strokePrecisionContextContract(PathGeometryCache);

import {
  strokeSegmentCacheContract,
  strokeSegmentReuseContract,
} from '../contracts/stroke-reuse';
strokeSegmentCacheContract(packing.StrokeSegmentCache);
strokeSegmentReuseContract(
  () => path().entity,
  (shape, d) => {
    shape.read(Path).d = d;
  },
  (shape, cap, join) => {
    shape.read(Stroke).linecap = cap;
    shape.read(Stroke).linejoin = join;
  },
  (shape) => {
    shape.read(GlobalTransform).matrix.m20 = 91;
    shape.read(GlobalTransform).matrix.m21 = -30;
  },
  (device, full) =>
    new (full ? SmoothPolyline : StrokeBatch)(
      device,
      null,
      null,
      null,
      false,
      0,
    ),
);

import { strokePageBuffersContract } from '../contracts/stroke-page-buffers';
strokePageBuffersContract(
  () => path().entity,
  (device, full) =>
    new (full ? SmoothPolyline : StrokeBatch)(
      device,
      null,
      null,
      null,
      false,
      0,
      null,
    ),
);
