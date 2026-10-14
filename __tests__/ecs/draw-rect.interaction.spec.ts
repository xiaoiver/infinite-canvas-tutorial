import { Pen, type API, type RectSerializedNode } from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
let other: API;

beforeAll(async () => {
  world = await createSelectionWorld(2);
  [api, other] = world.apis;
});

beforeEach(async () => {
  for (const editor of [api, other]) {
    await world.reset(editor, []);
    editor.setAppState({ penbarSelected: Pen.DRAW_RECT });
  }
  await world.frames();
});

afterAll(async () => {
  await world?.dispose();
});

const rectangles = (editor = api) =>
  editor
    .getNodes()
    .filter((node) => node.type === 'rect') as RectSerializedNode[];

it('commits a rectangle and records one undo step', async () => {
  await world.pointer(api, 'pointerdown', 20, 30);
  await world.pointer(api, 'pointermove', 100, 90);
  await world.pointer(api, 'pointerup', 100, 90);

  expect(rectangles()).toHaveLength(1);
  expect(rectangles()[0]).toMatchObject({
    x: 20,
    y: 30,
    width: 80,
    height: 60,
  });
  expect(api.getAppState().layersSelected).toEqual([rectangles()[0].id]);
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  await world.history(api, 'undo');
  expect(rectangles()).toHaveLength(0);
  await world.history(api, 'redo');
  expect(rectangles()).toHaveLength(1);
});

it('does not commit a canceled drag on pointercancel or a late pointerup', async () => {
  await world.pointer(api, 'pointerdown', 20, 30);
  await world.pointer(api, 'pointermove', 100, 90);
  await world.pointer(api, 'pointercancel', 100, 90);
  await world.pointer(api, 'pointerup', 100, 90);

  expect(rectangles()).toHaveLength(0);
  expect(api.getAppState().layersSelected).toEqual([]);
  expect(rectangles(other)).toHaveLength(0);
});

it('does not commit a canceled drag after Escape and release', async () => {
  await world.pointer(api, 'pointerdown', 20, 30);
  await world.pointer(api, 'pointermove', 100, 90);
  await world.key(api, 'Escape');
  await world.pointer(api, 'pointerup', 100, 90);

  expect(rectangles()).toHaveLength(0);
  expect(api.getAppState().layersSelected).toEqual([]);
});

it('does not revive an old preview after switching tools', async () => {
  await world.pointer(api, 'pointerdown', 20, 30);
  await world.pointer(api, 'pointermove', 100, 90);
  api.setAppState({ penbarSelected: Pen.SELECT });
  await world.frames();
  api.setAppState({ penbarSelected: Pen.DRAW_RECT });
  await world.frames();
  await world.pointer(api, 'pointerup', 100, 90);

  expect(rectangles()).toHaveLength(0);
});

it('commits the release point when down, move and up arrive in one frame', async () => {
  world.dispatch(api, 'pointerdown', 20, 30);
  world.dispatch(api, 'pointermove', 100, 90);
  world.dispatch(api, 'pointerup', 110, 100);
  await world.frames();

  expect(rectangles()).toHaveLength(1);
  expect(rectangles()[0]).toMatchObject({
    x: 20,
    y: 30,
    width: 90,
    height: 70,
  });
});

it('normalizes a reverse drag and commits with the size label disabled', async () => {
  api.setAppState({ penbarDrawSizeLabelVisible: false });
  await world.pointer(api, 'pointerdown', 110, 100);
  await world.pointer(api, 'pointermove', 20, 30);
  await world.pointer(api, 'pointerup', 20, 30);

  expect(rectangles()).toHaveLength(1);
  expect(rectangles()[0]).toMatchObject({
    x: 20,
    y: 30,
    width: 90,
    height: 70,
  });
});

it('keeps the start and end of a reverse line drag', async () => {
  api.setAppState({ penbarSelected: Pen.DRAW_LINE });
  await world.pointer(api, 'pointerdown', 110, 100);
  await world.pointer(api, 'pointermove', 20, 30);
  await world.pointer(api, 'pointerup', 20, 30);

  expect(api.getNodes()).toHaveLength(1);
  expect(api.getNodes()[0]).toMatchObject({
    type: 'polyline',
    x: 20,
    y: 30,
    points: '90,70 0,0',
  });
});

it('commits a normalized polygon after a reverse drag', async () => {
  api.setAppState({ penbarSelected: Pen.DRAW_TRIANGLE });
  await world.pointer(api, 'pointerdown', 110, 100);
  await world.pointer(api, 'pointermove', 20, 30);
  await world.pointer(api, 'pointerup', 20, 30);

  expect(api.getNodes()).toHaveLength(1);
  expect(api.getNodes()[0]).toMatchObject({ type: 'path' });
  expect(api.getNodes()[0].width).toBeGreaterThan(0);
  expect(api.getNodes()[0].height).toBeGreaterThan(0);
});

it.each([
  [Pen.DRAW_ELLIPSE, 'ellipse'],
  [Pen.DRAW_ROUGH_RECT, 'rough-rect'],
  [Pen.DRAW_ROUGH_ELLIPSE, 'rough-ellipse'],
  [Pen.DRAW_ROUGH_LINE, 'rough-polyline'],
  [Pen.DRAW_PENTAGON, 'path'],
  [Pen.DRAW_HEXAGON, 'path'],
  [Pen.DRAW_ICONFONT, 'iconfont'],
] as const)('commits %s as %s', async (pen, type) => {
  api.setAppState({ penbarSelected: pen });
  await world.pointer(api, 'pointerdown', 20, 30);
  await world.pointer(api, 'pointermove', 110, 100);
  await world.pointer(api, 'pointerup', 110, 100);

  expect(api.getNodes()).toHaveLength(1);
  expect(api.getNodes()[0].type).toBe(type);
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
});
