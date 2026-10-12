import type {
  Buffer,
  RenderPipeline,
  Sampler,
  Texture,
} from '../../packages/device-api/src';
import { MeshDrawBindings } from '../../packages/ecs/src/systems/mesh3d/mesh-draw-bindings';
import { fakeMeshGPU } from './helpers/mesh-gpu';

function setup() {
  const gpu = fakeMeshGPU();
  const model = {} as Buffer;
  const cache = new MeshDrawBindings(gpu.device, model);
  const args: [RenderPipeline, Buffer, Sampler, Texture, Texture, Texture] = [
    {} as RenderPipeline,
    {} as Buffer,
    {} as Sampler,
    {} as Texture,
    {} as Texture,
    {} as Texture,
  ];
  return { gpu, model, cache, args };
}

it.each(['pipeline', 'scene UBO', 'sampler', 'base color', 'specular', 'bump'])(
  'reuses bindings until the %s resource changes',
  (kind) => {
    const { gpu, model, cache, args } = setup();
    const first = cache.get(...args);
    expect(cache.get(...args)).toBe(first);
    expect(first.destroy).not.toHaveBeenCalled();
    const index = [
      'pipeline',
      'scene UBO',
      'sampler',
      'base color',
      'specular',
      'bump',
    ].indexOf(kind);
    args[index] = {} as Texture & Sampler & Buffer & RenderPipeline;
    const second = cache.get(...args);
    expect(second).not.toBe(first);
    expect(gpu.mocks.createBindings).toHaveBeenCalledTimes(2);
    expect(gpu.mocks.createBindings).toHaveBeenLastCalledWith({
      pipeline: args[0],
      uniformBufferBindings: [{ buffer: args[1] }, { buffer: model }],
      samplerBindings: args
        .slice(3)
        .map((texture) => ({ texture, sampler: args[2] })),
    });
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(cache.get(...args)).toBe(second);
    cache.destroy();
    cache.destroy();
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(() => cache.get(...args)).toThrow('disposed');
    gpu.scope.dispose();
  },
);

it('keeps the previous binding through allocation failure and retries the new resources', () => {
  const { gpu, cache, args } = setup();
  const old = cache.get(...args);
  const next = [...args] as typeof args;
  next[3] = {} as Texture;
  gpu.mocks.createBindings.mockImplementationOnce(() => {
    throw new Error('allocation');
  });
  expect(() => cache.get(...next)).toThrow('allocation');
  expect(old.destroy).not.toHaveBeenCalled();
  expect(cache.get(...args)).toBe(old);
  expect(cache.get(...next)).not.toBe(old);
  expect(old.destroy).toHaveBeenCalledTimes(1);
  cache.destroy();
  gpu.scope.dispose();
});

it('publishes the replacement before a failed release and disposes empty caches', () => {
  const { gpu, cache, args } = setup();
  const old = cache.get(...args);
  (old.destroy as jest.Mock).mockImplementationOnce(() => {
    throw new Error('release');
  });
  args[5] = {} as Texture;
  expect(() => cache.get(...args)).toThrow('release');
  expect(cache.get(...args)).toBe(gpu.bindings[1]);
  expect(gpu.mocks.createBindings).toHaveBeenCalledTimes(2);
  cache.destroy();
  const empty = new MeshDrawBindings(gpu.device, {} as Buffer);
  empty.destroy();
  empty.destroy();
  gpu.scope.dispose();
});
