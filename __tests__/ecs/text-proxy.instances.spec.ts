import {
  GlobalTransform,
  GlobalRenderOrder,
  Text,
  ComputedTextMetrics,
  FillLayers,
  Opacity,
  type Entity,
} from '../../packages/ecs/src';
import {
  TextProxy,
  TEXT_PROXY_PAGE_SIZE,
} from '../../packages/ecs/src/drawcalls/TextProxy';
import { fakeMeshGPU } from './helpers/mesh-gpu';

function text(lines = 2, translation = 10) {
  const values = new Map<unknown, any>([
    [Text, { textAlign: 'left' }],
    [
      ComputedTextMetrics,
      {
        width: 40,
        lineHeight: 12,
        lines: Array(lines).fill('label'),
        lineMetrics: Array.from({ length: lines }, () => ({ width: 40 })),
        fontMetrics: { fontSize: 10, fontBoundingBoxAscent: 8 },
      },
    ],
    [
      GlobalTransform,
      { matrix: { m00: 2, m01: 3, m10: 4, m11: 5, m20: translation, m21: 20 } },
    ],
    [GlobalRenderOrder, { value: 7 }],
    [
      FillLayers,
      {
        layers: [{ type: 'solid', value: 'rgba(10,20,30,0.6)', opacity: 0.5 }],
      },
    ],
    [Opacity, { opacity: 0.7 }],
  ]);
  return {
    entity: {
      has: (type: unknown) => values.has(type),
      read: (type: unknown) => values.get(type),
    } as unknown as Entity,
    values,
  };
}

it('packs each line with the full affine transform, paint alpha and order; camera frames upload no rows', () => {
  const gpu = fakeMeshGPU();
  const draw = new TextProxy(
    gpu.device,
    null,
    gpu.renderCache,
    null,
    true,
    0,
    null,
  );
  const nodes = Array.from({ length: 17 }, (_, i) => text(2, 10 + i).entity);
  Object.assign(draw, { program: { setUniformsLegacy: jest.fn() } });
  draw.shapes = nodes.slice(0, 2);
  draw.createGeometry();
  draw.render(gpu.pass, null, {});
  expect(draw.isInstanced).toBe(true);
  expect(draw.lineInstanceCount).toBe(4);
  expect(gpu.pass.drawIndexed).toHaveBeenLastCalledWith(6, 4);
  const data = new Float32Array(gpu.buffers[2].bytes.buffer);
  expect([...data.slice(0, 10)]).toEqual([0, 4, 40, 4, 2, 3, 4, 5, 10, 20]);
  expect(data[10]).toBeCloseTo(7 / 100000);
  expect(data[11]).toBeCloseTo(0.7);
  [10, 20, 30].forEach((value, i) =>
    expect(data[12 + i]).toBeCloseTo(value / 255),
  );
  expect(data[15]).toBeCloseTo(0.3);
  expect(data[17]).toBe(16);
  gpu.buffers[2].setSubData.mockClear();
  draw.render(gpu.pass, null, { u_ZoomScale: 2 });
  expect(gpu.buffers[2].setSubData).not.toHaveBeenCalled();
  draw.dirtyInstances.add(nodes[1]);
  draw.render(gpu.pass, null, {});
  expect(
    gpu.buffers[2].setSubData.mock.calls.map(([offset, bytes]) => [
      offset,
      bytes.byteLength,
    ]),
  ).toEqual([[128, 128]]);
  draw.shapes = nodes;
  draw.createGeometry();
  expect(gpu.buffers).toHaveLength(4);
  expect(gpu.buffers[2].destroy).toHaveBeenCalledTimes(1);
  draw.shapes = nodes.slice(0, 2).reverse();
  draw.createGeometry();
  draw.render(gpu.pass, null, {});
  expect(gpu.buffers).toHaveLength(4);
  expect(new Float32Array(gpu.buffers[3].bytes.buffer)[8]).toBe(11);
  draw.destroy();
  draw.destroy();
  gpu.buffers.forEach((buffer) =>
    expect(buffer.destroy).toHaveBeenCalledTimes(1),
  );
  gpu.scope.dispose();
});

it.each([true, false])(
  'releases geometry even if program creation never completes (instanced=%s)',
  (instanced) => {
    const gpu = fakeMeshGPU();
    const draw = new TextProxy(
      gpu.device,
      null,
      gpu.renderCache,
      null,
      instanced,
      0,
      null,
    );
    draw.shapes = [text().entity];
    draw.createGeometry();
    expect(draw.isInstanced).toBe(instanced);
    draw.destroy();
    gpu.buffers.forEach((buffer) =>
      expect(buffer.destroy).toHaveBeenCalledTimes(1),
    );
    gpu.scope.dispose();
  },
);

it('counts only nonempty lines and declines oversized or unsupported paints', () => {
  const node = text();
  node.values.get(ComputedTextMetrics).lines[1] = ' ';
  expect(TextProxy.instanceCount(node.entity)).toBe(1);
  expect(TextProxy.batchKey(node.entity)).toBe('solid-lines');
  node.values.get(FillLayers).layers[0].type = 'gradient';
  expect(TextProxy.batchKey(node.entity)).toBeNull();
  expect(TextProxy.batchKey(text(TEXT_PROXY_PAGE_SIZE + 1).entity)).toBeNull();
});

it('creates complete device state and privately releases page bindings', () => {
  const gpu = fakeMeshGPU();
  Object.assign(gpu.device, {
    queryVendorInfo: () => ({ platformString: 'WebGL2' }),
  });
  const draw = new TextProxy(
    gpu.device,
    null,
    gpu.renderCache,
    null,
    true,
    0,
    null,
  );
  draw.shapes = [text().entity];
  draw.createGeometry();
  draw.createMaterial('#define USE_INSTANCES\n', null);
  const descriptor = gpu.mocks.createRenderPipeline.mock.calls[0][0];
  expect(descriptor.megaStateDescriptor.stencilFront).toBeDefined();
  expect(descriptor.megaStateDescriptor.stencilBack).toBeDefined();
  const bindings = gpu.bindings[0];
  draw.destroy();
  expect(bindings.destroy).toHaveBeenCalledTimes(1);
  gpu.buffers.forEach((buffer) =>
    expect(buffer.destroy).toHaveBeenCalledTimes(1),
  );
  gpu.scope.dispose();
  expect(bindings.destroy).toHaveBeenCalledTimes(1);
});
