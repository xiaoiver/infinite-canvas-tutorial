import {
  Rect,
  Circle,
  Ellipse,
  GlobalRenderOrder,
  FillLayers,
  StrokeLayers,
  Stroke,
  Opacity,
  InnerShadow,
  StrokeAttenuation,
  type Entity,
} from '../../packages/ecs/src';
import { SDF } from '../../packages/ecs/src/drawcalls/SDF';

function shape(
  type: unknown = Rect,
  geometry: object = { x: 10, y: 20, width: 30, height: 40, cornerRadius: 4 },
) {
  const data = new Map<unknown, any>([
    [type, geometry],
    [GlobalRenderOrder, { value: 9 }],
    [FillLayers, { layers: [{ type: 'solid', value: '#112233', opacity: 1 }] }],
    [
      StrokeLayers,
      { layers: [{ type: 'solid', value: '#445566', opacity: 1 }] },
    ],
    [Stroke, { width: 3, alignment: 'outer', dasharray: [0, 0] }],
    [Opacity, { opacity: 0.7 }],
    [InnerShadow, { color: '#778899', offsetX: 2, offsetY: 3, blurRadius: 4 }],
    [StrokeAttenuation, {}],
  ]);
  return {
    entity: {
      has: (t: unknown) => data.has(t),
      read: (t: unknown) => {
        if (!data.has(t)) throw Error('Unexpected read');
        return data.get(t);
      },
    } as unknown as Entity,
    data,
  };
}
function pack(draw: SDF, entity: Entity) {
  draw.shapes = [entity];
  return (draw as any).generateBuffer(entity, 1, 2) as [
    number[],
    Record<string, number[]>,
  ];
}
const draw = (instanced: boolean) =>
  new SDF(null, null, null, null, instanced, 0, null);
it('preserves packed shader fields and keeps full-pass legacy arrays independent', () => {
  const { entity, data } = shape(),
    full = draw(false),
    instance = draw(true);
  const [flat, legacy] = pack(full, entity);
  expect(flat).toEqual([
    25,
    40,
    9.5 / 100000,
    0,
    15,
    20,
    0,
    0,
    1,
    1,
    1,
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
    1,
    1,
    4194306,
    119 / 255,
    136 / 255,
    153 / 255,
    1,
    2,
    3,
    4,
    0,
    0,
    0,
    0,
    0,
  ]);
  const instanceRow = flat.slice(0, 32);
  instanceRow.splice(8, 4, 17 / 255, 34 / 255, 51 / 255, 1);
  expect(pack(instance, entity)).toEqual([instanceRow, {}]);
  expect(Object.values(legacy).flat()).toEqual(flat);
  const saved = structuredClone(legacy);
  data.get(Rect).x = 100;
  data.get(FillLayers).layers[0].value = 'red';
  pack(full, entity);
  flat[0] = 999;
  expect(legacy).toEqual(saved);
});
it.each([
  [
    Circle,
    { cx: 4, cy: 5, r: 6 },
    [4, 5, 9.5 / 100000, 0, 6, 6, 0, 0],
    4194304,
  ],
  [
    Ellipse,
    { cx: 4, cy: 5, rx: 6, ry: 7 },
    [4, 5, 9.5 / 100000, 0, 6, 7, 0, 0],
    4194305,
  ],
])(
  'retains circle/ellipse geometry and attenuation bits',
  (type, geometry, expected, kind) => {
    const { entity } = shape(type, geometry);
    const [row] = pack(draw(true), entity);
    expect(row.slice(0, 8)).toEqual(expected);
    expect(row[23]).toBe(kind);
  },
);
