import {
  ComputedRough,
  Rough,
  type API,
  type SerializedNode,
} from '../../packages/ecs/src';
import { computeDrawableSets } from '../../packages/ecs/src/systems/ComputeRough';
import { generator } from '../../packages/ecs/src/utils';
import { createDocumentWorld } from '../helpers/ecs-document';

const shape = (patch: Partial<SerializedNode> = {}): SerializedNode =>
  ({
    id: 'rough',
    type: 'rough-rect',
    zIndex: 0,
    x: 0,
    y: 0,
    width: 60,
    height: 40,
    fills: [{ type: 'solid', value: 'red' }],
    strokes: [{ type: 'solid', value: 'black' }],
    strokeWidth: 2,
    roughSeed: 7,
    ...patch,
  } as SerializedNode);

const parameters = [
  ['roughSeed', 'seed', 17, 1],
  ['roughRoughness', 'roughness', 0, 1],
  ['roughBowing', 'bowing', 0, 1],
  ['roughFillStyle', 'fillStyle', 'solid', 'hachure'],
  ['roughFillWeight', 'fillWeight', 3, -1],
  ['roughHachureAngle', 'hachureAngle', 0, -41],
  ['roughHachureGap', 'hachureGap', 8, -1],
  ['roughCurveStepCount', 'curveStepCount', 16, 9],
  ['roughCurveFitting', 'curveFitting', 0.8, 0.95],
  ['roughDisableMultiStroke', 'disableMultiStroke', true, false],
  ['roughDisableMultiStrokeFill', 'disableMultiStrokeFill', true, false],
  ['roughSimplification', 'simplification', 0.5, 0],
  ['roughDashOffset', 'dashOffset', 6, -1],
  ['roughDashGap', 'dashGap', 3, -1],
  ['roughZigzagOffset', 'zigzagOffset', 4, -1],
  ['roughPreserveVertices', 'preserveVertices', true, false],
  ['roughFillLineDash', 'fillLineDash', [4, 2], []],
  ['roughFillLineDashOffset', 'fillLineDashOffset', 3, 0],
] as const;

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let reloaded: API;
beforeAll(async () => {
  world = await createDocumentWorld(2);
  [api, reloaded] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
const settle = async () => {
  await world.frame();
  await world.frame();
};
const state = (editor = api) => {
  const entity = editor.getEntity(editor.getNodeById('rough'));
  const rough = entity.read(Rough);
  return structuredClone({
    parameters: Object.fromEntries(
      parameters.map(([, field]) => [field, rough[field]]),
    ),
    sets: entity.read(ComputedRough).drawableSets,
  });
};
const load = async (node: SerializedNode) => {
  await world.reset(api, [node]);
  await settle();
  api.clearHistory();
};
const update = async (patch: Partial<SerializedNode>) => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('rough'), patch),
  );
  await settle();
};
async function expectReload() {
  await world.reset(reloaded, structuredClone(api.getNodes()));
  await settle();
  expect(state(reloaded)).toEqual(state());
}

it.each(parameters)(
  'updates and clears %s consistently through history and reload',
  async (key, field, value, fallback) => {
    await load(
      shape(
        key === 'roughCurveStepCount' || key === 'roughCurveFitting'
          ? { type: 'rough-ellipse', cx: 30, cy: 20, rx: 30, ry: 20 }
          : {},
      ),
    );
    const before = state();
    await update({ [key]: value });
    const after = state();
    expect(after.parameters[field]).toEqual(
      typeof value === 'number' ? Math.fround(value) : value,
    );
    await expectReload();
    await world.history(api, 'undo');
    await settle();
    expect(state()).toEqual(before);
    await world.history(api, 'redo');
    await settle();
    expect(state()).toEqual(after);
    await update({ [key]: undefined });
    const cleared = state();
    expect(cleared.parameters[field]).toEqual(
      typeof fallback === 'number' ? Math.fround(fallback) : fallback,
    );
    expect(api.getNodeById('rough')).not.toHaveProperty(key);
    await expectReload();
    await world.history(api, 'undo');
    await settle();
    expect(state()).toEqual(after);
    await world.history(api, 'redo');
    await settle();
    expect(state()).toEqual(cleared);
  },
);

it('preserves exact path endpoints when preserveVertices is enabled', async () => {
  await load(
    shape({
      type: 'rough-polyline',
      points: '0,0 30,20 60,0',
      roughPreserveVertices: true,
    }),
  );
  const strokes = state().sets.filter((set) => set.type === 'path');
  const endpoints = strokes.flatMap((set) =>
    set.ops
      .filter((op) => op.op === 'move' || op.op === 'bcurveTo')
      .map((op) => (op.op === 'move' ? op.data : op.data.slice(-2))),
  );
  for (const point of endpoints)
    expect([
      [0, 0],
      [30, 20],
      [60, 0],
    ]).toContainEqual(point);
  await update({ roughPreserveVertices: false });
  expect(state().sets).not.toEqual(strokes);
  await world.history(api, 'undo');
  await settle();
  expect(state().sets).toEqual(strokes);
});

it('uses both x and y origins when exporting a translated rough line', () => {
  const node = shape({
    type: 'rough-line',
    x: 20,
    y: 30,
    x1: 20,
    y1: 30,
    x2: 80,
    y2: 70,
    roughRoughness: 0,
  });
  const sets = computeDrawableSets(node);
  const endpoints = sets.flatMap((set) =>
    set.ops.filter((op) => op.op === 'bcurveTo').map((op) => op.data.slice(-2)),
  );
  expect(endpoints.length).toBeGreaterThan(0);
  for (const point of endpoints) expect(point).toEqual([60, 40]);
});

it.each(['dashed', 'zigzag-line'] as const)(
  'has usable default spacing for %s fill',
  async (fillStyle) => {
    await load(shape({ roughFillStyle: fillStyle }));
    const sets = state().sets;
    expect(
      sets.some((set) => set.type === 'fillSketch' && set.ops.length > 0),
    ).toBe(true);
    expect(
      sets
        .flatMap((set) => set.ops.flatMap((op) => op.data))
        .every(Number.isFinite),
    ).toBe(true);
    await expectReload();
  },
);

it('keeps the same seeded stroke when only the fill changes', async () => {
  await load(shape());
  const stroke = () => state().sets.filter((set) => set.type === 'path');
  const before = stroke();
  await update({ fills: [{ type: 'solid', value: 'blue' }] });
  expect(stroke()).toEqual(before);
  expect(before).toEqual(
    generator
      .rectangle(0, 0, 60, 40, { seed: 7, stroke: 'black', strokeWidth: 2 })
      .sets.filter((set) => set.type === 'path'),
  );
});
