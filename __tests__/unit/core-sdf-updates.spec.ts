import { Rect } from '../../packages/core/src';
import { SDF } from '../../packages/core/src/drawcalls/SDF';
function scene(instanced = true, wireframe = false) {
  const buffers: any[] = [];
  const resource = () => ({ destroy: jest.fn(), setUniformsLegacy: jest.fn() });
  const device: any = {
    queryVendorInfo: () => ({ platformString: 'WebGL2' }),
    setResourceName: jest.fn(),
    createBuffer: ({ viewOrSize }: any) => {
      const data =
        typeof viewOrSize === 'number'
          ? new Uint8Array(viewOrSize)
          : new Uint8Array(viewOrSize.buffer.slice(0));
      let dead = false;
      const buffer = {
        data,
        destroy: jest.fn(() => {
          dead = true;
        }),
        setSubData: jest.fn((offset: number, bytes: Uint8Array) => {
          if (dead) throw Error('Uploading to retired buffer');
          data.set(bytes, offset);
        }),
      };
      buffers.push(buffer);
      return buffer;
    },
  };
  const cache: any = {
    createProgram: resource,
    createInputLayout: resource,
    createRenderPipeline: resource,
    createBindings: resource,
    releaseBindings: () => true,
  };
  const pass: any = {
    setPipeline() {},
    setVertexInput() {},
    setBindings() {},
    drawIndexed: jest.fn(),
  };
  const draw = new SDF(device, cache, null, instanced, 0);
  const shapes = Array.from({ length: instanced ? 3 : 1 }, (_, i) => {
    const shape = new Rect({
      x: i * 30,
      y: 10,
      width: 20,
      height: 20,
      fill: 'red',
      wireframe,
    });
    shape.globalRenderOrder = i + 1;
    return shape;
  });
  draw.shapes = shapes;
  draw.createGeometry();
  draw.createMaterial('', {} as any);
  const render = () => {
    draw.render(pass, {});
    draw.geometryDirty = false;
    shapes.forEach((s) => (s.renderDirtyFlag = false));
  };
  const clear = () => buffers.forEach((b) => b.setSubData.mockClear());
  render();
  clear();
  return { draw, shapes, buffers, pass, render, clear };
}
it('updates paint and affine streams independently and skips conservative no-op dirtiness', () => {
  const t = scene();
  t.shapes[1].fill = 'blue';
  t.render();
  expect(
    t.buffers[2].setSubData.mock.calls.map(([o, b]: any) => [o, b.length]),
  ).toEqual([[128, 128]]);
  expect(t.buffers[3].setSubData).not.toHaveBeenCalled();
  t.clear();
  t.shapes[1].renderDirtyFlag = true;
  t.render();
  expect(t.buffers[2].setSubData).not.toHaveBeenCalled();
  t.shapes[1].worldTransform.tx = 15;
  t.shapes[1].renderDirtyFlag = true;
  t.render();
  expect(t.buffers[2].setSubData).not.toHaveBeenCalled();
  expect(
    t.buffers[3].setSubData.mock.calls.map(([o, b]: any) => [o, b.length]),
  ).toEqual([[24, 24]]);
  t.draw.destroy();
});
it('refreshes instanced and full depth even without a paint dirty marker', () => {
  for (const instanced of [true, false]) {
    const t = scene(instanced);
    const shape = t.shapes[0];
    shape.globalRenderOrder = 100;
    t.render();
    const data = new Float32Array(t.buffers[2].data.buffer);
    expect(data[(instanced ? 0 : 12) + 16]).toBe(Math.fround(100 / 100000));
    expect(t.buffers[2].setSubData).toHaveBeenCalledTimes(1);
    t.draw.destroy();
  }
});
it('retries an upload after flags clear and never uploads queued rows after retirement', () => {
  const t = scene(),
    failure = new Error('upload failed');
  t.shapes[1].fill = 'blue';
  t.buffers[2].setSubData.mockImplementationOnce(() => {
    throw failure;
  });
  expect(() => t.render()).toThrow(failure);
  t.draw.geometryDirty = false;
  t.shapes.forEach((s) => (s.renderDirtyFlag = false));
  t.render();
  expect(t.buffers[2].setSubData).toHaveBeenCalledTimes(2);
  t.clear();
  t.shapes[1].worldTransform.tx = 22;
  t.shapes[1].renderDirtyFlag = true;
  t.buffers[3].setSubData.mockImplementationOnce(() => {
    throw failure;
  });
  expect(() => t.render()).toThrow(failure);
  t.draw.geometryDirty = false;
  t.shapes.forEach((s) => (s.renderDirtyFlag = false));
  t.render();
  expect(t.buffers[3].setSubData).toHaveBeenCalledTimes(2);
  expect(t.buffers[2].setSubData).not.toHaveBeenCalled();
  t.shapes[1].fill = 'green';
  t.buffers[2].setSubData.mockImplementationOnce(() => {
    throw failure;
  });
  expect(() => t.render()).toThrow(failure);
  t.draw.destroy();
  t.clear();
  t.draw.render(t.pass, {});
  t.buffers.forEach((buffer) =>
    expect(buffer.setSubData).not.toHaveBeenCalled(),
  );
});
it('rebinds mirrors when wireframe rebuilding replaces physical buffers', () => {
  const t = scene(true, true);
  t.shapes[0].fill = 'blue';
  t.render();
  expect(t.pass.drawIndexed).toHaveBeenCalled();
  t.draw.destroy();
});
