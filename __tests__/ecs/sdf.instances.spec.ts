import { GlobalTransform, type Entity } from '../../packages/ecs/src';
import { SDF } from '../../packages/ecs/src/drawcalls/SDF';
import { fakeMeshGPU } from './helpers/mesh-gpu';

it('preserves affine translation, uploads only changed rows, and grows buffers without reallocating on shrink', () => {
  const gpu = fakeMeshGPU();
  const draw = new SDF(gpu.device, null, gpu.renderCache, null, true, 0, null);
  const nodes = Array.from(
    { length: 17 },
    (_, row) =>
      ({
        has: () => false,
        read: (type: unknown) => {
          if (type !== GlobalTransform) throw new Error('Unexpected read');
          return {
            matrix: {
              m00: 2,
              m01: 3,
              m10: 4,
              m11: 5,
              m20: 10 + row,
              m21: 20 + row,
            },
          };
        },
      } as unknown as Entity),
  );
  // GPU upload boundary; colors/opacity and shader results are tested in Chromium.
  jest
    .spyOn(draw, 'generateBuffer')
    .mockReturnValue([new Array(32).fill(7), {}]);
  Object.assign(draw, { program: { setUniformsLegacy: jest.fn() } });
  draw.shapes = nodes.slice(0, 3);
  draw.createGeometry();
  draw.render(gpu.pass, null, {});
  expect(
    [...new Float32Array(gpu.buffers[3].bytes.buffer)].slice(0, 6),
  ).toEqual([2, 3, 4, 5, 10, 20]);
  const instanceBuffers = gpu.buffers.slice(2);
  instanceBuffers.forEach((buffer) => buffer.setSubData.mockClear());
  draw.render(gpu.pass, null, {});
  instanceBuffers.forEach((buffer) =>
    expect(buffer.setSubData).not.toHaveBeenCalled(),
  );
  draw.dirtyInstances.add(nodes[1]);
  draw.render(gpu.pass, null, {});
  expect(
    instanceBuffers.map((buffer) =>
      buffer.setSubData.mock.calls.map(([offset, data]) => [
        offset,
        data.byteLength,
      ]),
    ),
  ).toEqual([[[128, 128]], [[24, 24]]]);
  draw.shapes = nodes;
  draw.createGeometry();
  expect(gpu.buffers).toHaveLength(6);
  instanceBuffers.forEach((buffer) =>
    expect(buffer.destroy).toHaveBeenCalledTimes(1),
  );
  draw.shapes = nodes.slice(0, 2).reverse();
  draw.createGeometry();
  draw.render(gpu.pass, null, {});
  expect(gpu.buffers).toHaveLength(6);
  expect(
    [...new Float32Array(gpu.buffers[5].bytes.buffer)].slice(0, 12),
  ).toEqual([2, 3, 4, 5, 11, 21, 2, 3, 4, 5, 10, 20]);
  draw.destroy();
  gpu.buffers.forEach((buffer) =>
    expect(buffer.destroy).toHaveBeenCalledTimes(1),
  );
  gpu.scope.dispose();
});
