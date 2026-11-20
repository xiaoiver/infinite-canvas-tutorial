import { Rect, Circle, Ellipse } from '../../packages/core/src';
import { SDF } from '../../packages/core/src/drawcalls/SDF';

const pack = (draw: SDF, shape: any) =>
  (draw as any).generateBuffer(shape, 1, 2) as [
    number[],
    Record<string, number[]>,
  ];
function styled() {
  const shape = new Rect({
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    cornerRadius: 4,
    fill: '#112233',
    stroke: '#445566',
    strokeWidth: 3,
    strokeAlignment: 'outer',
    opacity: 0.7,
    fillOpacity: 0.5,
    strokeOpacity: 0.6,
    innerShadowColor: '#778899',
    innerShadowOffsetX: 2,
    innerShadowOffsetY: 3,
    innerShadowBlurRadius: 4,
    sizeAttenuation: false,
    strokeAttenuation: true,
  });
  shape.globalRenderOrder = 9;
  shape.strokeAttenuation = true;
  return shape;
}
it('preserves the shader row layout, depth, alpha, attenuation and full legacy ownership', () => {
  const shape = styled(),
    full = new SDF(null, null, null, false, 0),
    instance = new SDF(null, null, null, true, 0);
  const [row, legacy] = pack(full, shape);
  expect(row).toEqual([
    25,
    40,
    9.5 / 100000,
    0,
    15,
    20,
    0,
    0,
    17 / 255,
    34 / 255,
    51 / 255,
    1,
    68 / 255,
    85 / 255,
    102 / 255,
    1,
    9 / 100000,
    3,
    4,
    2,
    0.7,
    0.5,
    0.6,
    4194306,
    119 / 255,
    136 / 255,
    153 / 255,
    1,
    2,
    3,
    4,
    0,
  ]);
  expect(pack(instance, shape)).toEqual([row, {}]);
  expect(Object.values(legacy).flat()).toEqual(row);
  const saved = structuredClone(legacy);
  shape.x = 100;
  shape.fill = 'red';
  pack(full, shape);
  row[0] = 999;
  expect(legacy).toEqual(saved);
});
it.each([
  [new Circle({ cx: 4, cy: 5, r: 6 }), [4, 5, 0.5 / 100000, 0, 6, 6, 0, 0], 0],
  [
    new Ellipse({ cx: 4, cy: 5, rx: 6, ry: 7 }),
    [4, 5, 0.5 / 100000, 0, 6, 7, 0, 0],
    1,
  ],
])(
  'packs circle and ellipse geometry with their shader type',
  (shape, geometry, type) => {
    shape.globalRenderOrder = 0;
    const [row] = pack(new SDF(null, null, null, true, 0), shape);
    expect(row.slice(0, 8)).toEqual(geometry);
    expect(row[23]).toBe(type);
  },
);
it('keeps allocated instance storage through paint and transform updates, then replaces it for new membership', () => {
  const buffers: any[] = [];
  const device: any = {
    createBuffer: ({ viewOrSize }: any) => {
      const data = new Uint8Array(viewOrSize.buffer.slice(0));
      const result = {
        data,
        destroy: jest.fn(),
        setSubData: jest.fn((offset: number, bytes: Uint8Array) =>
          data.set(bytes, offset),
        ),
      };
      buffers.push(result);
      return result;
    },
  };
  const draw = new SDF(
    device,
    { releaseBindings: jest.fn() } as any,
    null,
    true,
    0,
  );
  const a = styled(),
    b = new Circle({ cx: 2, cy: 3, r: 4, fill: 'blue' });
  draw.shapes = [a, b];
  draw.createGeometry();
  Object.assign(draw, { program: { setUniformsLegacy: jest.fn() } });
  const pass: any = {
    setPipeline() {},
    setVertexInput() {},
    setBindings() {},
    drawIndexed() {},
  };
  const storage = (draw as any).vertexBufferDatas.slice();
  draw.render(pass, {});
  const old = buffers[2].data.slice();
  a.fill = 'red';
  a.worldTransform.set(2, 3, 4, 5, 6, 7);
  draw.render(pass, {});
  expect((draw as any).vertexBufferDatas[1]).toBe(storage[1]);
  expect((draw as any).vertexBufferDatas[2]).toBe(storage[2]);
  expect(buffers[2].data).not.toEqual(old);
  expect([...new Float32Array(buffers[3].data.buffer)].slice(0, 6)).toEqual([
    2, 3, 4, 5, 6, 7,
  ]);
  expect(buffers[2].setSubData.mock.calls.at(-1)[1].byteLength).toBe(32 * 4);
  draw.shapes = [b];
  draw.createGeometry();
  draw.render(pass, {});
  expect((draw as any).vertexBufferDatas[1]).toHaveLength(32);
  expect((draw as any).vertexBufferDatas[1]).not.toBe(storage[1]);
  expect(buffers[2].destroy).toHaveBeenCalledTimes(1);
  draw.destroy();
});
