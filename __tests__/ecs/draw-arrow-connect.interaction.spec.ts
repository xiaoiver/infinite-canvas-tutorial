import {
  Pen,
  Path,
  type API,
  type PathSerializedNode,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
const originalPathHitTest = Path.hitTestProvider;

beforeAll(async () => {
  // Preview paths cannot bind; skip Canvas Path2D hit testing in this Node world.
  Path.hitTestProvider = () => false;
  world = await createSelectionWorld();
  [api] = world.apis;
});

beforeEach(async () => {
  await world.reset(api, []);
  api.setAppState({ penbarSelected: Pen.DRAW_ARROW });
  await world.frames();
});

afterEach(async () => {
  await world.key(api, 'Escape');
  api.setAppState({ penbarSelected: Pen.SELECT });
  await world.frames();
});

afterAll(async () => {
  await world?.dispose();
  Path.hitTestProvider = originalPathHitTest;
});

const paths = () =>
  api.getNodes().filter((node) => node.type === 'path') as PathSerializedNode[];
const rect = (id: string, x: number): RectSerializedNode => ({
  id,
  type: 'rect',
  x,
  y: 40,
  width: 40,
  height: 40,
  zIndex: 0,
  fills: [{ type: 'solid', value: 'red' }],
});

it('moves the preview along horizontal and vertical pointer motion', async () => {
  await world.click(api, 20, 20);
  expect(paths()).toHaveLength(1);

  await world.pointer(api, 'pointermove', 80, 20);
  expect(paths()[0].sourcePoint).toEqual({ x: 20, y: 20 });
  expect(paths()[0].targetPoint).toEqual({ x: 80, y: 20 });

  await world.pointer(api, 'pointermove', 80, 70);
  expect(paths()[0].targetPoint).toEqual({ x: 80, y: 70 });

  const previewId = paths()[0].id;
  await world.click(api, 80, 70);
  expect(paths()).toHaveLength(1);
  expect(paths()[0].id).not.toBe(previewId);
  expect(paths()[0]).toMatchObject({
    sourcePoint: { x: 20, y: 20 },
    targetPoint: { x: 80, y: 70 },
  });
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  await world.history(api, 'undo');
  expect(paths()).toHaveLength(0);
  await world.history(api, 'redo');
  expect(paths()).toHaveLength(1);
});

it('previews and commits bindings between two shapes', async () => {
  await world.reset(api, [rect('from', 20), rect('to', 120)]);
  await world.frames();
  await world.click(api, 40, 60);
  expect(paths()).toHaveLength(1);
  expect(paths()[0].fromId).toBe('from');

  await world.pointer(api, 'pointermove', 140, 60);
  expect(paths()[0].toId).toBe('to');
  expect(paths()[0].targetPoint).toBeUndefined();

  await world.click(api, 140, 60);
  expect(paths()).toHaveLength(1);
  expect(paths()[0]).toMatchObject({ fromId: 'from', toId: 'to' });
  expect(paths()[0].entryX).toBeCloseTo(0.5);
  expect(paths()[0].entryY).toBeCloseTo(0.5);
});

it('keeps a shape source bound when the other endpoint is free', async () => {
  await world.reset(api, [rect('from', 20)]);
  await world.frames();
  await world.click(api, 40, 60);
  await world.pointer(api, 'pointermove', 100, 60);
  expect(paths()[0]).toMatchObject({
    fromId: 'from',
    targetPoint: { x: 100, y: 60 },
  });
  await world.click(api, 100, 60);
  expect(paths()).toHaveLength(1);
  expect(paths()[0]).toMatchObject({
    fromId: 'from',
    targetPoint: { x: 100, y: 60 },
  });
  expect(paths()[0].toId).toBeUndefined();
});

it('keeps a free source fixed when the target binds to a shape', async () => {
  await world.reset(api, [rect('to', 120)]);
  await world.frames();
  await world.click(api, 10, 10);
  await world.pointer(api, 'pointermove', 140, 60);
  expect(paths()[0]).toMatchObject({
    sourcePoint: { x: 10, y: 10 },
    toId: 'to',
  });
  await world.click(api, 140, 60);
  expect(paths()).toHaveLength(1);
  expect(paths()[0]).toMatchObject({
    sourcePoint: { x: 10, y: 10 },
    toId: 'to',
  });
  expect(paths()[0].fromId).toBeUndefined();
});

it('ignores a second click on the source shape', async () => {
  await world.reset(api, [rect('from', 20)]);
  await world.frames();
  await world.click(api, 40, 60);
  const previewId = paths()[0].id;
  await world.click(api, 40, 60);
  expect(paths()).toHaveLength(1);
  expect(paths()[0].id).toBe(previewId);
  expect(api.getAppState().penbarSelected).toBe(Pen.DRAW_ARROW);
  await world.click(api, 100, 60);
  expect(paths()).toHaveLength(1);
  expect(paths()[0].id).not.toBe(previewId);
  expect(paths()[0].fromId).toBe('from');
});

it('cancels a preview without recording an edge', async () => {
  await world.click(api, 20, 20);
  await world.pointer(api, 'pointermove', 80, 20);
  expect(paths()).toHaveLength(1);
  await world.key(api, 'Escape');
  expect(paths()).toHaveLength(0);
  expect(api.isUndoStackEmpty()).toBe(true);
  await world.click(api, 30, 30);
  expect(paths()).toHaveLength(1);
  api.setAppState({ penbarSelected: Pen.SELECT });
  await world.frames();
  expect(paths()).toHaveLength(0);
});
