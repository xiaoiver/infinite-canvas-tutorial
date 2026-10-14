import {
  BrushType,
  Pen,
  type API,
  type BrushSerializedNode,
} from '../../packages/ecs/src';
import { deserializeBrushPoints } from '../../packages/ecs/src/utils';
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
    editor.setAppState({
      penbarSelected: Pen.BRUSH,
      penbarBrush: {
        ...editor.getAppState().penbarBrush,
        brushType: BrushType.VANILLA,
        stamps: [],
        strokeWidth: 20,
      },
    });
  }
  await world.frames();
});

afterEach(async () => {
  for (const editor of [api, other])
    editor.setAppState({ penbarSelected: Pen.SELECT });
  await world.frames();
});

afterAll(async () => {
  await world?.dispose();
});

const brushes = (editor = api) =>
  editor
    .getNodes()
    .filter((node) => node.type === 'brush') as BrushSerializedNode[];

const dispatchPointer = (
  editor: API,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  x: number,
  y: number,
  timeStamp: number,
  options: {
    pointerType?: 'mouse' | 'touch' | 'pen';
    pressure?: number;
    coalesced?: { x: number; y: number; timeStamp: number; pressure: number }[];
  } = {},
) => {
  const event = new world.window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerType: { value: options.pointerType ?? 'mouse' },
    pointerId: { value: 1 },
    pressure: { value: options.pressure ?? 0.5 },
    timeStamp: { value: timeStamp },
    getCoalescedEvents: {
      value: () =>
        options.coalesced?.map((sample) => ({
          clientX: sample.x,
          clientY: sample.y,
          timeStamp: sample.timeStamp,
          pressure: sample.pressure,
        })) ?? [],
    },
  });
  editor.getCanvasElement().dispatchEvent(event);
  world.assertNoErrors();
};

const pointer = async (...args: Parameters<typeof dispatchPointer>) => {
  dispatchPointer(...args);
  await world.frames();
};

it('commits pen pressure, selects the brush, and records one undo step', async () => {
  await pointer(api, 'pointerdown', 20, 40, 0, {
    pointerType: 'pen',
    pressure: 0.2,
  });
  await pointer(api, 'pointermove', 60, 40, 100, {
    pointerType: 'pen',
    pressure: 0.8,
  });
  await pointer(api, 'pointerup', 100, 40, 200, {
    pointerType: 'pen',
    pressure: 0,
  });

  expect(brushes()).toHaveLength(1);
  const brush = brushes()[0];
  const points = deserializeBrushPoints(brush.points!);
  expect(points[0].radius).toBeCloseTo(4, 1);
  expect(points[points.length - 1].radius).toBeGreaterThan(10);
  expect(api.getAppState().layersSelected).toEqual([brush.id]);
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
  await world.history(api, 'undo');
  expect(brushes()).toHaveLength(0);
  await world.history(api, 'redo');
  expect(brushes()).toHaveLength(1);
});

it('uses coalesced mouse samples so a slow stroke is wider than a fast stroke', async () => {
  const draw = async (interval: number) => {
    api.setAppState({ penbarSelected: Pen.BRUSH });
    await world.frames();
    await pointer(api, 'pointerdown', 10, 50, 0);
    const coalesced = Array.from({ length: 19 }, (_, index) => ({
      x: 22 + index * 12,
      y: 50,
      timeStamp: (index + 1) * interval,
      pressure: 0.5,
    }));
    await pointer(api, 'pointermove', 250, 50, 20 * interval, { coalesced });
    await pointer(api, 'pointerup', 250, 50, 21 * interval);
    const points = deserializeBrushPoints(brushes().at(-1)!.points!);
    return points[points.length - 1].radius;
  };

  const fast = await draw(6);
  const slow = await draw(80);
  expect(slow).toBeGreaterThan(fast * 1.3);
  expect(brushes()).toHaveLength(2);
});

it('cancels an unfinished stroke without changing either canvas document', async () => {
  await pointer(api, 'pointerdown', 20, 40, 0);
  await pointer(api, 'pointermove', 100, 40, 40);
  await world.key(api, 'Escape');
  await pointer(api, 'pointerup', 130, 40, 80);

  expect(brushes()).toHaveLength(0);
  expect(brushes(other)).toHaveLength(0);
  await world.history(api, 'undo');
  expect(brushes()).toHaveLength(0);
});

it('commits the release position when down, move and up arrive in one frame', async () => {
  dispatchPointer(api, 'pointerdown', 20, 40, 0);
  dispatchPointer(api, 'pointermove', 70, 40, 40);
  dispatchPointer(api, 'pointerup', 120, 40, 80);
  await world.frames();

  expect(brushes()).toHaveLength(1);
  const brush = brushes()[0];
  const points = deserializeBrushPoints(brush.points!);
  expect((brush.x ?? 0) + points[points.length - 1].x).toBeCloseTo(120);
  expect(api.getAppState().penbarSelected).toBe(Pen.SELECT);
});

it('drops an active stroke when the tool changes before release', async () => {
  await pointer(api, 'pointerdown', 20, 40, 0);
  await pointer(api, 'pointermove', 100, 40, 40);
  api.setAppState({ penbarSelected: Pen.SELECT });
  await world.frames();
  await pointer(api, 'pointerup', 130, 40, 80);

  expect(brushes()).toHaveLength(0);
  expect(api.getAppState().layersSelected).toEqual([]);
});

it('cancels one canvas pointer without interrupting another canvas stroke', async () => {
  await pointer(api, 'pointerdown', 20, 40, 0);
  await pointer(other, 'pointerdown', 30, 60, 0);
  await pointer(api, 'pointermove', 100, 40, 40);
  await pointer(other, 'pointermove', 120, 60, 40);
  await pointer(api, 'pointercancel', 100, 40, 50);
  await pointer(other, 'pointerup', 150, 60, 80);
  await pointer(api, 'pointerup', 140, 40, 80);

  expect(brushes()).toHaveLength(0);
  expect(brushes(other)).toHaveLength(1);

  await pointer(api, 'pointerdown', 20, 80, 100);
  await pointer(api, 'pointermove', 100, 80, 140);
  await pointer(api, 'pointerup', 150, 80, 180);
  expect(brushes()).toHaveLength(1);
  expect(brushes(other)).toHaveLength(1);
});
