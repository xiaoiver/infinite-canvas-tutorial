import {
  API,
  Brush,
  ComputedBounds,
  ComputedPoints,
  Ellipse,
  Line,
  Polyline,
  Rect,
  Rough,
  Stroke,
  Transform,
  type SerializedNode,
} from '../../packages/ecs/src';
import { inferXYWidthHeight } from '../../packages/ecs/src/utils/deserialize/entity';
import { createDocumentWorld } from '../helpers/ecs-document';

const identity = { id: 'shape', zIndex: 0 };
const examples: [string, SerializedNode, number[], object][] = [
  [
    'rectangle',
    { ...identity, type: 'rect', width: 40, height: 20 },
    [0, 0, 40, 20],
    {},
  ],
  [
    'rough rectangle',
    { ...identity, type: 'rough-rect', width: 40, height: 20 },
    [0, 0, 40, 20],
    {},
  ],
  [
    'ellipse',
    { ...identity, type: 'ellipse', cx: 30, cy: 40, rx: 10, ry: 15 },
    [20, 25, 20, 30],
    {},
  ],
  [
    'rough ellipse',
    { ...identity, type: 'rough-ellipse', cx: 30, cy: 40, rx: 10, ry: 15 },
    [20, 25, 20, 30],
    {},
  ],
  [
    'line',
    { ...identity, type: 'line', x1: 30, y1: -10, x2: 10, y2: 20 },
    [10, -10, 20, 30],
    { x1: 20, y1: 0, x2: 0, y2: 30 },
  ],
  [
    'rough line',
    { ...identity, type: 'rough-line', x1: 30, y1: -10, x2: 10, y2: 20 },
    [10, -10, 20, 30],
    { x1: 20, y1: 0, x2: 0, y2: 30 },
  ],
  [
    'polyline',
    { ...identity, type: 'polyline', points: '-10,20 30,20 30,50' },
    [-10, 20, 40, 30],
    { points: '0,0 40,0 40,30' },
  ],
  [
    'rough polyline',
    { ...identity, type: 'rough-polyline', points: '-10,20 30,20 30,50' },
    [-10, 20, 40, 30],
    { points: '0,0 40,0 40,30' },
  ],
  [
    'path',
    { ...identity, type: 'path', d: 'M10 20 L50 20 L50 50' },
    [10, 20, 40, 30],
    {},
  ],
  [
    'rough path',
    { ...identity, type: 'rough-path', d: 'M10 20 L50 20 L50 50' },
    [10, 20, 40, 30],
    {},
  ],
  [
    'brush',
    { ...identity, type: 'brush', points: '10,20,2 50,20,8 50,50,4' },
    [10, 20, 40, 30],
    { points: '0,0,2 40,0,8 40,30,4' },
  ],
  [
    'vector network',
    {
      ...identity,
      type: 'vector-network',
      vertices: [
        { x: -10, y: 20 },
        { x: 30, y: 50 },
      ],
      segments: [{ start: 0, end: 1 }],
    },
    [-10, 20, 40, 30],
    {
      vertices: [
        { x: 0, y: 0 },
        { x: 40, y: 30 },
      ],
    },
  ],
];

it.each(examples)(
  'normalizes %s to local geometry exactly once',
  (_name, input, box, geometry) => {
    const node = structuredClone(input);
    inferXYWidthHeight(node);
    expect([node.x, node.y, node.width, node.height]).toEqual(box);
    expect(node).toMatchObject(geometry);
    const normalized = structuredClone(node);
    inferXYWidthHeight(node);
    expect(node).toEqual(normalized);
  },
);

it.each(['g', 'light3d'] as const)(
  'leaves %s dimensions to its owning system',
  (type) => {
    const node: SerializedNode =
      type === 'light3d'
        ? { ...identity, type, lightType: 'ambient' }
        : { ...identity, type };
    const original = structuredClone(node);
    expect(inferXYWidthHeight(node)).toBe(node);
    expect(node).toEqual(original);
  },
);

it('preserves explicitly supplied zero dimensions, transforms, and local points', () => {
  const node: SerializedNode = {
    ...identity,
    type: 'polyline',
    x: 40,
    y: 50,
    width: 0,
    height: 0,
    scaleX: -2,
    scaleY: 3,
    rotation: 0.5,
    points: '10,20 30,40',
  };
  const original = structuredClone(node);
  inferXYWidthHeight(node);
  expect(node).toEqual(original);
});

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
beforeAll(async () => {
  world = await createDocumentWorld(2);
  [api] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
const pose = (editor: API) => {
  const entity = editor.getEntity(editor.getNodeById('shape'));
  const transform = entity.read(Transform);
  const bounds = entity.read(ComputedBounds).geometryWorldBounds;
  return {
    translation: [transform.translation.x, transform.translation.y],
    bounds: [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY],
    points: entity.has(ComputedPoints)
      ? structuredClone(
          entity.read(ComputedPoints).points ??
            entity.read(ComputedPoints).shiftedPoints,
        )
      : undefined,
  };
};

it.each(examples.filter(([name]) => name !== 'vector network'))(
  'loads and reloads normalized %s without moving it',
  async (_name, node, [x, y, width, height]) => {
    await world.reset(api, [structuredClone(node)]);
    await world.frame();
    const initial = pose(api);
    expect(initial.translation).toEqual([x, y]);
    initial.bounds.forEach((value, i) =>
      expect(value).toBeCloseTo([x, y, x + width, y + height][i]),
    );
    const entity = api.getEntity(api.getNodeById('shape'));
    expect(entity.has(Stroke)).toBe(false);
    expect(entity.has(Rough)).toBe(node.type.startsWith('rough-'));
    if (entity.has(Rect))
      expect(entity.read(Rect)).toMatchObject({ x: 0, y: 0, width, height });
    if (entity.has(Ellipse))
      expect(entity.read(Ellipse)).toMatchObject({
        cx: width / 2,
        cy: height / 2,
        rx: width / 2,
        ry: height / 2,
      });
    if (entity.has(Line))
      expect(entity.read(Line)).toMatchObject({ x1: 20, y1: 0, x2: 0, y2: 30 });
    if (entity.has(Polyline))
      expect(entity.read(Polyline).points).toEqual([
        [0, 0],
        [40, 0],
        [40, 30],
      ]);
    if (entity.has(Brush))
      expect(entity.read(Brush).points).toEqual([
        { x: 0, y: 0, radius: 2 },
        { x: 40, y: 0, radius: 8 },
        { x: 40, y: 30, radius: 4 },
      ]);
    const reloaded = world.apis[1];
    await world.reset(reloaded, structuredClone(api.getNodes()));
    await world.frame();
    expect(pose(reloaded)).toEqual(initial);
  },
);
