import type { Buffer, RenderPipeline } from '../../packages/device-api/src';
import { ShadowDrawBindings } from '../../packages/ecs/src/systems/mesh3d/shadow-draw-bindings';
import { fakeMeshGPU } from './helpers/mesh-gpu';

it('keeps six face bindings live until the point shadow pass has finished', () => {
  const gpu = fakeMeshGPU();
  const cache = new ShadowDrawBindings(gpu.device, {} as Buffer);
  const pipeline = {} as RenderPipeline;
  const buffers = Array.from({ length: 6 }, () => ({} as Buffer));
  const bindings = buffers.map((buffer) => cache.get(pipeline, buffer));
  expect(gpu.mocks.createBindings).toHaveBeenCalledTimes(6);
  buffers.forEach((buffer, index) => {
    expect(cache.get(pipeline, buffer)).toBe(bindings[index]);
    expect(bindings[index].destroy).not.toHaveBeenCalled();
  });
  cache.destroy();
  bindings.forEach((binding) =>
    expect(binding.destroy).toHaveBeenCalledTimes(1),
  );
  gpu.scope.dispose();
});
