import {
  FillLayers,
  GlobalTransform,
  Mat3,
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
