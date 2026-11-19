import { createCanvas } from 'canvas';
import { Path, Rect, RoughPath, DOMAdapter } from '../../packages/core/src';
import { PathInstances } from '../../packages/core/src/drawcalls/PathInstances';
import { BatchManager } from '../../packages/core/src/drawcalls/BatchManager';
import { SDF } from '../../packages/core/src/drawcalls/SDF';
import { Mesh } from '../../packages/core/src/drawcalls/Mesh';
import { HashMap } from '../../packages/core/src/utils/hashmap';
import { RenderCache } from '../../packages/core/src/utils/render-cache';
import { destroyInputLayout } from '../../packages/core/src/utils/destroy-input-layout';

beforeAll(() => {
  jest
    .spyOn(DOMAdapter.get(), 'createCanvas')
    .mockImplementation(
      (width = 1, height = 1) => createCanvas(width, height) as any,
    );
});
afterAll(() => jest.restoreAllMocks());

function harness() {
  let id = 0;
  const resource = () => ({
    id: id++,
    destroy: jest.fn(),
    setUniformsLegacy: jest.fn(),
  });
  const buffers: any[] = [];
  const device: any = {
    queryVendorInfo: () => ({ platformString: 'WebGL2' }),
    setResourceName: jest.fn(),
    createBindings: jest.fn(resource),
    createProgram: jest.fn(resource),
    createInputLayout: jest.fn(resource),
    createRenderPipeline: jest.fn(resource),
    createBuffer: jest.fn(({ viewOrSize }) => {
      const data =
        typeof viewOrSize === 'number'
          ? new Uint8Array(viewOrSize)
          : new Uint8Array(viewOrSize.buffer.slice(0));
      const b = {
        ...resource(),
        data,
        setSubData: jest.fn((offset: number, bytes: Uint8Array) =>
          data.set(bytes, offset),
        ),
      };
      buffers.push(b);
      return b;
    }),
  };
  const cache: any = {
    createProgram: resource,
    createBindings: resource,
    createInputLayout: resource,
    createRenderPipeline: resource,
    releaseBindings: jest.fn(),
  };
  const pass: any = {
    setPipeline: jest.fn(),
    setVertexInput: jest.fn(),
    setBindings: jest.fn(),
    drawIndexed: jest.fn(),
  };
  const make = (fill = 'red', x = 0) => {
    const p = new Path({ d: 'M0 0 L20 0 L20 20 Z', strokeWidth: 0, fill });
    p.batchable = true;
    p.worldTransform.tx = x;
    p.globalRenderOrder = 1;
    return p;
  };
  return { device, cache, pass, buffers, make };
}
it('uses exact geometry/linear-transform keys and safely excludes complex styles', () => {
  expect(new Path({ d: 'M0 0 H20 V20 Z', batchable: true }).batchable).toBe(
    true,
  );
  const { make } = harness();
  const a = make(),
    b = make('blue', 20);
  expect(PathInstances.batchKey(a)).not.toBeNull();
  expect(PathInstances.batchKey(a)).toBe(PathInstances.batchKey(b));
  b.worldTransform.a = -1;
  expect(PathInstances.batchKey(b)).not.toBe(PathInstances.batchKey(a));
  b.worldTransform.a = 0;
  expect(PathInstances.batchKey(b)).toBeNull();
  for (const change of [
    { wireframe: true },
    { sizeAttenuation: true },
    { batchable: false },
    { stroke: 'red', strokeWidth: 2 },
    { fill: 'linear-gradient(red,blue)' },
    { innerShadowBlurRadius: 3 },
  ]) {
    const p = make();
    Object.assign(p, change);
    expect(PathInstances.batchKey(p)).toBeNull();
  }
  expect(PathInstances.batchKey(new Rect())).toBeNull();
  expect(PathInstances.batchKey(new RoughPath({ d: a.d }))).toBeNull();
});
it('retries failed row writes, skips identical rows and reuses mesh buffers across membership changes', () => {
  const { device, cache, pass, buffers, make } = harness();
  const a = make(),
    b = make('blue', 20);
  const draw = new PathInstances(device, cache, null, true, 0);
  draw.shapes = [a, b];
  const submit = () => draw.submit(pass, {} as any, {});
  submit();
  expect(buffers).toHaveLength(3);
  const rows = buffers[2];
  rows.setSubData.mockClear();
  a.fill = 'blue';
  rows.setSubData.mockImplementationOnce(() => {
    throw new Error('upload failed');
  });
  expect(submit).toThrow('upload failed');
  submit();
  expect(rows.setSubData).toHaveBeenCalledTimes(2);
  expect(rows.setSubData.mock.calls[1][1]).toHaveLength(48);
  draw.geometryDirty = true;
  submit();
  expect(rows.setSubData).toHaveBeenCalledTimes(2);
  expect(buffers).toHaveLength(3);
  draw.shapes = [b];
  draw.geometryDirty = true;
  submit();
  expect(new Float32Array(rows.data.buffer)[4]).toBe(20);
  expect(pass.drawIndexed).toHaveBeenLastCalledWith(3, 1);
  draw.destroy();
  draw.destroy();
  for (const buffer of buffers) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});
it('plans only consecutive compatible Paths, pages at 4096, and releases inactive geometry keys', () => {
  const { device, pass, make } = harness();
  const batch = new BatchManager(device);
  const sizes: number[] = [];
  const spy = jest
    .spyOn(PathInstances.prototype, 'render')
    .mockImplementation(function () {
      sizes.push(this.shapes.length);
    });
  const submit = (paths: Path[], instances = true) => {
    sizes.length = 0;
    batch.clear(true, instances);
    paths.forEach((p) => batch.add(p));
    batch.flush(pass, {} as any, {});
  };
  const paths = Array.from({ length: 4097 }, () => make());
  submit(paths);
  expect(sizes).toEqual([4096]);
  submit(paths.slice(0, 2));
  expect(sizes).toEqual([2]);
  for (let i = 0; i < 5; i++) {
    const p = make();
    p.d = `M0 0 H${30 + i} V20 Z`;
    const q = make();
    q.d = p.d;
    submit([p, q]);
    expect(buffersAlive()).toBe(3);
  }
  function buffersAlive() {
    return device.createBuffer.mock.results.filter(
      (r: any) => r.value.destroy.mock.calls.length === 0,
    ).length;
  }
  submit([]);
  expect(buffersAlive()).toBe(0);
  const middle = make();
  middle.d = 'M0 0 H30 V20 Z';
  const middle2 = make();
  middle2.d = middle.d;
  submit([paths[0], paths[1], middle, middle2, paths[2], paths[3]]);
  expect(sizes).toEqual([2, 2, 2]);
  spy.mockRestore();
  batch.destroy();
});
it('export intent and feature-off Paths use individual full meshes even after opting into batchable', () => {
  const { device, pass, make } = harness();
  const batch = new BatchManager(device);
  const sizes: number[] = [];
  const spy = jest
    .spyOn(Mesh.prototype, 'render')
    .mockImplementation(function () {
      sizes.push(this.shapes.length);
    });
  const paths = [make(), make('blue', 20)];
  for (const ordered of [false, true]) {
    batch.clear(ordered, false);
    paths.forEach((p) => batch.add(p));
    batch.flush(pass, {} as any, {});
  }
  expect(sizes).toEqual([1, 1, 1, 1]);
  spy.mockRestore();
  batch.destroy();
});
it.each([false, true])(
  'finishes deletion of an unbound VAO without altering binding state (WebGL2=%s)',
  (webgl2) => {
    const vao = {} as WebGLVertexArrayObject;
    const dispose = jest.fn();
    const ext = { isVertexArrayOES: () => true, deleteVertexArrayOES: dispose };
    const gl = webgl2
      ? { isVertexArray: () => true, deleteVertexArray: dispose }
      : {};
    const layout: any = {
      vao,
      device: { gl, OES_vertex_array_object: ext },
      destroy: jest.fn(),
    };
    destroyInputLayout(layout);
    expect(layout.destroy).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledWith(vao);
  },
);
it('leaves already deleted VAOs and non-WebGL layouts to their own destructor', () => {
  const destroy = jest.fn(),
    dispose = jest.fn();
  destroyInputLayout({ destroy } as any);
  destroyInputLayout({
    destroy,
    vao: {},
    device: { gl: { isVertexArray: () => false, deleteVertexArray: dispose } },
  } as any);
  expect(destroy).toHaveBeenCalledTimes(2);
  expect(dispose).not.toHaveBeenCalled();
});

it('releases retired Mesh binding descriptors instead of retaining dead buffer references', () => {
  const { device } = harness();
  const cache = new RenderCache(device);
  const descriptor: any = {
    uniformBufferBindings: [{ buffer: { id: 10 }, offset: 0, size: 192 }],
  };
  const first = cache.createBindings(descriptor);
  expect(cache.createBindings(descriptor)).toBe(first);
  cache.releaseBindings(first);
  expect(first.destroy).not.toHaveBeenCalled();
  cache.releaseBindings(first);
  expect(first.destroy).toHaveBeenCalledTimes(1);
  expect(cache.createBindings(descriptor)).not.toBe(first);
  cache.destroy();
  expect(first.destroy).toHaveBeenCalledTimes(1);
});

it('keeps SDF batching inside consecutive runs and retires the separated run', () => {
  const { device, pass, make } = harness();
  const batch = new BatchManager(device);
  const sizes: number[] = [];
  const spy = jest
    .spyOn(SDF.prototype, 'render')
    .mockImplementation(function () {
      sizes.push(this.shapes.length);
    });
  const rects = Array.from(
    { length: 4 },
    () => new Rect({ width: 20, height: 20, strokeWidth: 0 }),
  );
  batch.clear(true);
  [rects[0], rects[1], make(), rects[2], rects[3]].forEach((s) => batch.add(s));
  batch.flush(pass, {} as any, {});
  expect(sizes).toEqual([2, 2]);
  sizes.length = 0;
  batch.clear(true);
  rects.forEach((s) => batch.add(s));
  batch.flush(pass, {} as any, {});
  expect(sizes).toEqual([4]);
  spy.mockRestore();
  batch.destroy();
  for (const r of device.createBuffer.mock.results)
    expect(r.value.destroy).toHaveBeenCalledTimes(1);
});

it('releases geometry allocated before a material failure, and clears empty full Mesh geometry', () => {
  const { device, cache, buffers, make, pass } = harness();
  const path = make();
  const draw = new Mesh(device, cache, null, false, 0);
  draw.shapes = [path];
  draw.createGeometry();
  expect(buffers).toHaveLength(2);
  draw.destroy();
  draw.destroy();
  buffers.forEach((b) => expect(b.destroy).toHaveBeenCalledTimes(1));
  const next = new Mesh(device, cache, null, false, 0);
  next.shapes = [path];
  next.submit(pass, {} as any, {});
  path.d = '';
  next.geometryDirty = true;
  next.submit(pass, {} as any, {});
  expect(next.points).toEqual([]);
  path.d = 'M0 0 H20 V20 Z';
  next.geometryDirty = true;
  next.submit(pass, {} as any, {});
  expect(next.points.length).toBeGreaterThan(0);
  next.destroy();
});

it('reuses a clean visible plan on camera frames, but rechecks paint and capture intent', () => {
  const { device, pass, make } = harness();
  const batch = new BatchManager(device),
    paths = [make(), make('blue', 20)];
  const key = jest.spyOn(PathInstances, 'batchKey');
  const submit = (instances = true) => {
    batch.clear(true, instances);
    paths.forEach((p) => batch.add(p));
    batch.flush(pass, {} as any, {});
  };
  submit();
  paths.forEach((p) => {
    p.renderDirtyFlag = false;
    p.materialDirtyFlag = false;
    p.geometryDirtyFlag = false;
  });
  key.mockClear();
  submit();
  expect(key).not.toHaveBeenCalled();
  paths[0].opacity = 0.25;
  submit();
  expect(key).toHaveBeenCalled();
  key.mockClear();
  paths.forEach((p) => {
    p.renderDirtyFlag = false;
  });
  submit(false);
  expect(batch.stats().drawcallCount).toBe(2);
  key.mockRestore();
  batch.destroy();
});

it('does not retain empty descriptor buckets while retiring changing buffer keys', () => {
  const cache = new HashMap<number, object>(
    (a, b) => a === b,
    (k) => k,
  );
  for (let i = 0; i < 100; i++) {
    cache.add(i, {});
    cache.delete(i);
  }
  expect(cache.size()).toBe(0);
  expect(cache.buckets.size).toBe(0);
});
