import { createCanvas } from 'canvas';
import { BufferUsage } from '@antv/g-device-api';
import {
  DOMAdapter,
  Path,
  Polyline,
  Rect,
  Text,
} from '../../packages/core/src';
import { BatchManager } from '../../packages/core/src/drawcalls/BatchManager';
import { Drawcall } from '../../packages/core/src/drawcalls/Drawcall';

beforeAll(() => {
  jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockImplementation(
      (width = 1, height = 1) => createCanvas(width, height) as any,
    );
});
afterAll(() => jest.restoreAllMocks());

function harness() {
  const buffers: { destroy: jest.Mock }[] = [];
  const created: Drawcall[] = [];
  const rendered: Drawcall[] = [];
  const device: any = {
    createBuffer: jest.fn(() => {
      const buffer = { destroy: jest.fn() };
      buffers.push(buffer);
      return buffer;
    }),
  };
  class Fill extends Drawcall {
    constructor(...args: ConstructorParameters<typeof Drawcall>) {
      super(...args);
      created.push(this);
    }
    createGeometry() {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.indexBuffer = this.device.createBuffer({
        viewOrSize: 4,
        usage: BufferUsage.INDEX,
      });
      this.vertexBuffers = [
        this.device.createBuffer({ viewOrSize: 8, usage: BufferUsage.VERTEX }),
      ];
    }
    createMaterial() {}
    render() {
      if (this.destroyed) throw new Error('Disposed drawcall reached render');
      rendered.push(this);
    }
  }
  class Stroke extends Fill {}
  const batch = new BatchManager(device);
  jest
    .spyOn(batch as any, 'collectDrawcallCtors')
    .mockReturnValue([Fill, Stroke]);
  const flush = () => batch.flush({} as any, {} as any, {});
  return { batch, flush, created, rendered, buffers };
}

it.each([
  ['text', () => new Text({ content: 'Owned text', fontSize: 18 })],
  [
    'polyline',
    () =>
      new Polyline({
        points: [
          [0, 0],
          [20, 20],
        ],
      }),
  ],
  ['non-batched rectangle', () => new Rect({ batchable: false })],
  ['full Path', () => new Path({ d: 'M0 0 H20 V20 Z', batchable: true })],
] as const)(
  'retires every owned drawcall once when removing %s',
  (_name, make) => {
    const { batch, flush, created, buffers } = harness();
    const shape = make();
    batch.add(shape);
    flush();
    expect(created).toHaveLength(2);
    expect(buffers).toHaveLength(4);
    batch.remove(shape);
    batch.remove(shape);
    expect(created.every((drawcall) => drawcall.destroyed)).toBe(true);
    for (const buffer of buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    batch.destroy();
    batch.destroy();
    for (const buffer of buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
  },
);

it('never allocates or renders a removed queued text, and reentry gets fresh drawcalls', () => {
  const { batch, flush, created, rendered, buffers } = harness();
  const text = new Text({ content: 'Reentry', fontSize: 18 });
  batch.add(text);
  const retired = created.slice();
  batch.remove(text);
  flush();
  expect(rendered.map((drawcall) => drawcall.uid)).toEqual([]);
  expect(buffers).toEqual([]);
  expect(retired.every((drawcall) => drawcall.destroyed)).toBe(true);
  batch.clear();
  batch.add(text);
  flush();
  expect(rendered).toHaveLength(2);
  expect(rendered.every((drawcall) => !retired.includes(drawcall))).toBe(true);
  batch.destroy();
  for (const buffer of buffers) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it('does not retire shared batches when one rectangle leaves and its peer remains', () => {
  const { batch, flush, created, rendered, buffers } = harness();
  const a = new Rect(),
    b = new Rect();
  batch.add(a);
  batch.add(b);
  flush();
  const shared = created.slice();
  expect(shared).toHaveLength(2);
  batch.remove(a);
  expect(shared.every((drawcall) => !drawcall.destroyed)).toBe(true);
  expect(shared.map((drawcall) => drawcall.shapes)).toEqual([[b], [b]]);
  for (const buffer of buffers) expect(buffer.destroy).not.toHaveBeenCalled();
  rendered.length = 0;
  batch.clear();
  batch.add(b);
  flush();
  expect(rendered).toEqual(shared);
  batch.destroy();
  for (const buffer of buffers) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it('removing a never-rendered non-batched shape creates no cached resources', () => {
  const { batch, created, buffers } = harness();
  batch.remove(new Text({ content: 'Not attached' }));
  expect(created).toEqual([]);
  expect(buffers).toEqual([]);
  batch.destroy();
});

function orderedHarness() {
  const h = harness();
  h.batch.clear(true, false, false, false);
  return {
    ...h,
    members() {
      h.rendered.length = 0;
      h.flush();
      // This harness has two passes per non-batched shape.
      const members = h.rendered
        .filter((_d, i) => i % 2 === 0)
        .flatMap((d) => d.shapes);
      // The real renderer starts each frame with clear, then traverses members.
      h.batch.clear(true, false, false, false);
      members.forEach((shape) => h.batch.add(shape));
      return members;
    },
  };
}
const orderedRect = () => new Rect({ batchable: false });

it('keeps painter order through absent, repeated and interleaved ordered removals', () => {
  const { batch, members } = orderedHarness();
  const a = orderedRect(),
    b = orderedRect(),
    c = orderedRect(),
    absent = orderedRect();
  batch.add(a);
  batch.add(b);
  batch.add(a);
  batch.add(c);
  batch.remove(absent);
  batch.remove(a);
  batch.remove(a);
  batch.add(a);
  expect(members()).toEqual([b, c, a]);
  batch.remove(b);
  batch.add(b);
  batch.remove(c);
  expect(members()).toEqual([a, b]);
  batch.destroy();
});

it('retains only adds after the last removal, including duplicate adds and index zero', () => {
  const { batch, members } = orderedHarness();
  const a = orderedRect(),
    b = orderedRect();
  batch.remove(a);
  batch.add(a);
  batch.add(a);
  batch.add(b);
  expect(members()).toEqual([a, a, b]);
  batch.remove(a);
  batch.add(a);
  batch.remove(a);
  batch.add(a);
  batch.add(a);
  expect(members()).toEqual([b, a, a]);
  batch.destroy();
});

it('forgets ordered removal positions on clear and after changing planning modes', () => {
  const { batch, members } = orderedHarness();
  const a = orderedRect(),
    b = orderedRect();
  batch.add(a);
  batch.add(b);
  batch.remove(a);
  batch.clear(true, false);
  batch.add(a);
  expect(members()).toEqual([a]);
  batch.add(b);
  batch.remove(a);
  batch.clear(false);
  batch.clear(true, false);
  batch.add(a);
  expect(members()).toEqual([a]);
  batch.destroy();
});

it('keeps ordered camera ownership independent when an old manager removes a migrated shape', () => {
  const first = orderedHarness(),
    second = orderedHarness();
  const a = orderedRect(),
    b = orderedRect();
  first.batch.add(a);
  first.batch.add(b);
  expect(first.members()).toEqual([a, b]);
  first.batch.remove(a);
  second.batch.add(a);
  expect(first.members()).toEqual([b]);
  expect(second.members()).toEqual([a]);
  first.batch.remove(a);
  expect(first.members()).toEqual([b]);
  expect(second.members()).toEqual([a]);
  second.batch.remove(a);
  expect(second.members()).toEqual([]);
  first.batch.destroy();
  second.batch.destroy();
});

it('matches ordered append/remove semantics across a deterministic operation stream and frame boundaries', () => {
  const { batch, members } = orderedHarness();
  const shapes = Array.from({ length: 12 }, orderedRect);
  let expected: Rect[] = [],
    seed = 718;
  for (let i = 0; i < 160; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const shape = shapes[seed % shapes.length];
    if ((seed >>> 16) % 3 === 0) {
      batch.remove(shape);
      expected = expected.filter((s) => s !== shape);
    } else {
      batch.add(shape);
      expected.push(shape);
    }
    if (i % 7 === 0) expect(members()).toEqual(expected);
    if (i % 31 === 0) {
      batch.clear(true, false);
      expected = [];
    }
  }
  expect(members()).toEqual(expected);
  batch.destroy();
});

it('discards removed queued shapes when destruction precedes the first flush', () => {
  const { batch, flush, rendered, created, buffers } = harness();
  batch.clear(true, false, false, false);
  const a = orderedRect();
  batch.add(a);
  batch.remove(a);
  batch.destroy();
  flush();
  expect(rendered).toEqual([]);
  expect(created).toEqual([]);
  expect(buffers).toEqual([]);
});
