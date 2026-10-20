import type {
  Buffer,
  RenderPipeline,
  Sampler,
  Texture,
} from '../../packages/device-api/src';
import { ShadowDrawBindings } from '../../packages/ecs/src/systems/mesh3d/shadow-draw-bindings';
import { fakeMeshGPU } from './helpers/mesh-gpu';

it('keeps six face bindings live until the point shadow pass has finished', () => {
  const gpu = fakeMeshGPU();
  const cache = new ShadowDrawBindings(gpu.device, {} as Buffer);
  const pipeline = {} as RenderPipeline;
  const texture = {} as Texture;
  const sampler = {} as Sampler;
  const buffers = Array.from({ length: 6 }, () => ({} as Buffer));
  const bindings = buffers.map((buffer) =>
    cache.get(pipeline, buffer, texture, sampler),
  );
  expect(gpu.mocks.createBindings).toHaveBeenCalledTimes(6);
  buffers.forEach((buffer, index) => {
    expect(cache.get(pipeline, buffer, texture, sampler)).toBe(bindings[index]);
    expect(bindings[index].destroy).not.toHaveBeenCalled();
  });
  const loadedTexture = {} as Texture;
  const changed = cache.get(pipeline, buffers[0], loadedTexture, sampler);
  expect(changed).not.toBe(bindings[0]);
  expect(bindings[0].destroy).toHaveBeenCalledTimes(1);
  cache.destroy();
  for (const binding of bindings)
    expect(binding.destroy).toHaveBeenCalledTimes(1);
  expect(changed.destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});
