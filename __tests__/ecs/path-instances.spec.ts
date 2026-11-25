import {
  FillLayers,
  GlobalTransform,
  Mat3,
  Stroke,
  Rough,
  UI,
  FillTexture,
  Wireframe,
  SizeAttenuation,
  Filter,
  DropShadow,
  InnerShadow,
  ClipMode,
  NodeLayerBlendMode,
  Extrude3D,
  Path,
  type Entity,
} from '../../packages/ecs/src';
import { PathInstances } from '../../packages/ecs/src/drawcalls/PathInstances';

it('retries failed row writes, skips equal dirty rows and reuses geometry for material/membership changes', () => {
  let id = 0;
  const resource = () => ({
    id: id++,
    destroy: jest.fn(),
    setUniformsLegacy: jest.fn(),
  });
  const buffers: any[] = [];
  const device: any = {
    queryVendorInfo: () => ({ platformString: 'WebGL2' }),
    createBindings: jest.fn(resource),
    createBuffer: jest.fn(({ viewOrSize, usage }) => {
      const data =
        typeof viewOrSize === 'number'
          ? new Uint8Array(viewOrSize)
          : new Uint8Array(viewOrSize.buffer.slice(0));
      const buffer = {
        ...resource(),
        data,
        usage,
        setSubData: jest.fn((offset: number, bytes: Uint8Array) =>
          data.set(bytes, offset),
        ),
      };
      buffers.push(buffer);
      return buffer;
    }),
  };
  const cache: any = {
    createProgram: resource,
    createInputLayout: resource,
    createRenderPipeline: resource,
    releaseBindings: jest.fn(),
  };
  const make = (color: string, x: number) => {
    const m = Mat3.copy(Mat3.IDENTITY);
    m.m20 = x;
    const data = new Map<any, any>([
      [
        Path,
        {
          d: 'M0 0 L20 0 L20 20 Z',
          fillRule: 'nonzero',
          tessellationMethod: 0,
        },
      ],
      [GlobalTransform, { matrix: m }],
      [FillLayers, { layers: [{ type: 'solid', value: color }] }],
    ]);
    const entity = {
      has: (c: any) => data.has(c),
      hasSomeOf: (...cs: any[]) => cs.some((c) => data.has(c)),
      read: (c: any) => data.get(c),
    } as Entity;
    return { entity, data };
  };
  const a = make('red', 0),
    b = make('blue', 20);
  const draw = new PathInstances(
    device,
    { getCanvas: () => ({ width: 800, height: 600 }) } as any,
    cache,
    null,
    true,
    0,
    null,
  );
  draw.shapes = [a.entity, b.entity];
  const pass: any = {
    setViewport: jest.fn(),
    setPipeline: jest.fn(),
    setVertexInput: jest.fn(),
    setBindings: jest.fn(),
    drawIndexed: jest.fn(),
  };
  const scene = {
    u_ProjectionMatrix: [2 / 800, 0, 0, 0, -2 / 600, 0, -1, 1, 1],
    u_ViewMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    u_Viewport: [800, 600],
  };
  const submit = () => draw.submit(pass, {} as any, scene, {} as any);
  submit();
  expect(device.createBuffer).toHaveBeenCalledTimes(3);
  const instances = buffers[2];
  instances.setSubData.mockClear();
  a.data.set(FillLayers, { layers: [{ type: 'solid', value: 'blue' }] });
  draw.dirtyInstances.add(a.entity);
  instances.setSubData.mockImplementationOnce(() => {
    throw new Error('upload failed');
  });
  expect(submit).toThrow('upload failed');
  submit();
  expect(instances.setSubData).toHaveBeenCalledTimes(2);
  expect(instances.setSubData.mock.calls[1][0]).toBe(0);
  expect(instances.setSubData.mock.calls[1][1]).toHaveLength(48);
  const gpu = new Float32Array(instances.data.buffer);
  expect(gpu[8]).toBe(0);
  expect(gpu[10]).toBe(1);
  draw.dirtyInstances.add(a.entity);
  draw.geometryDirty = true;
  submit();
  expect(instances.setSubData).toHaveBeenCalledTimes(2);
  expect(device.createBuffer).toHaveBeenCalledTimes(3);
  draw.shapes = [b.entity];
  draw.geometryDirty = true;
  submit();
  expect(gpu[4]).toBe(20);
  expect(pass.drawIndexed).toHaveBeenLastCalledWith(3, 1);
  expect(device.createBuffer).toHaveBeenCalledTimes(3);
  draw.destroy();
  draw.destroy();
  for (const buffer of buffers) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

function fillCandidate(width?: number) {
  const data = new Map<unknown, any>([
    [Path, { d: 'M0 0H20V20Z', fillRule: 'nonzero', tessellationMethod: 0 }],
    [GlobalTransform, { matrix: Mat3.copy(Mat3.IDENTITY) }],
    [FillLayers, { layers: [{ type: 'solid', value: 'red' }] }],
  ]);
  if (width !== undefined) data.set(Stroke, { width });
  const effects = jest.fn((...types: unknown[]) =>
    types.some((t) => data.has(t)),
  );
  const entity = {
    has: (type: unknown) => data.has(type),
    hasSomeOf: effects,
    read: (type: unknown) => data.get(type),
  } as unknown as Entity;
  return { data, effects, entity };
}

it.each([undefined, 0, -0, -1, NaN, -Infinity, 1, Infinity])(
  'preserves the existing fill eligibility comparison for stroke width %p',
  (width) => {
    const { entity, effects } = fillCandidate(width);
    if (width > 0) {
      expect(PathInstances.batchKey(entity)).toBeNull();
      expect(effects).not.toHaveBeenCalled();
    } else {
      expect(PathInstances.batchKey(entity)).not.toBeNull();
      expect(effects).toHaveBeenCalledTimes(1);
    }
  },
);

it.each([
  Rough,
  UI,
  FillTexture,
  Wireframe,
  SizeAttenuation,
  Filter,
  DropShadow,
  InnerShadow,
  ClipMode,
  NodeLayerBlendMode,
  Extrude3D,
])(
  'retains complex-style fallback for a fill-only candidate with %p',
  (effect) => {
    const { data, entity, effects } = fillCandidate(0);
    data.set(effect, {});
    expect(PathInstances.batchKey(entity)).toBeNull();
    expect(effects).toHaveBeenCalledTimes(1);
  },
);

it('observes live stroke, effect, fill and matrix edits without caching eligibility', () => {
  const { entity, data } = fillCandidate(2);
  expect(PathInstances.batchKey(entity)).toBeNull();
  data.get(Stroke).width = 0;
  expect(PathInstances.batchKey(entity)).not.toBeNull();
  data.set(Filter, {});
  expect(PathInstances.batchKey(entity)).toBeNull();
  data.delete(Filter);
  expect(PathInstances.batchKey(entity)).not.toBeNull();
  const fill = data.get(FillLayers).layers[0];
  fill.blendMode = 'multiply';
  expect(PathInstances.batchKey(entity)).toBeNull();
  fill.blendMode = 'normal';
  data.get(GlobalTransform).matrix.m00 = 0;
  expect(PathInstances.batchKey(entity)).toBeNull();
  data.get(GlobalTransform).matrix.m00 = 1;
  expect(PathInstances.batchKey(entity)).not.toBeNull();
  data.get(Stroke).width = 2;
  expect(PathInstances.batchKey(entity)).toBeNull();
});
