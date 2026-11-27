import { ComputedCamera, Input, Pen, type API } from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;

beforeAll(async () => {
  world = await createSelectionWorld(2);
  [api] = world.apis;
});

beforeEach(async () => {
  api.setAppState({ penbarSelected: Pen.SELECT });
  await world.edit(
    api,
    (editor) =>
      editor.gotoLandmark(
        { x: 0, y: 0, zoom: 2, rotation: 0 },
        { duration: 0 },
      ),
    'NEVER',
  );
  await world.frames();
});

afterAll(async () => {
  await world?.dispose();
});

async function wheel(deltaX: number, deltaY: number, ctrlKey = false) {
  api.getCanvasElement().dispatchEvent(
    new world.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      deltaX,
      deltaY,
      ctrlKey,
    }),
  );
  world.assertNoErrors();
  await world.frames();
}

it('pans an unrotated camera in viewport wheel coordinates', async () => {
  await wheel(20, -10);
  const camera = api.getCamera().read(ComputedCamera);
  expect(camera.x).toBeCloseTo(10);
  expect(camera.y).toBeCloseTo(-5);
});

it('pans a rotated camera in the wheel direction on screen', async () => {
  await world.edit(
    api,
    (editor) => editor.gotoLandmark({ rotation: Math.PI / 2 }, { duration: 0 }),
    'NEVER',
  );
  await world.frames();
  const before = api.canvas2Viewport({ x: 0, y: 0 });

  await wheel(20, 0);

  const camera = api.getCamera().read(ComputedCamera);
  expect(camera.x).toBeCloseTo(0, 4);
  expect(camera.y).toBeCloseTo(10, 4);
  const after = api.canvas2Viewport({ x: 0, y: 0 });
  expect(after.x - before.x).toBeCloseTo(-20, 4);
  expect(after.y - before.y).toBeCloseTo(0, 4);
});

it('keeps the wheel zoom pivot fixed on a rotated camera', async () => {
  await world.edit(
    api,
    (editor) => editor.gotoLandmark({ rotation: Math.PI / 3 }, { duration: 0 }),
    'NEVER',
  );
  await world.frames();
  const pivot = api.viewport2Canvas({ x: 100, y: 100 });

  await wheel(0, -10, true);

  expect(api.getCamera().read(ComputedCamera).zoom).toBeGreaterThan(2);
  const after = api.viewport2Canvas({ x: 100, y: 100 });
  expect(after.x).toBeCloseTo(pivot.x, 3);
  expect(after.y).toBeCloseTo(pivot.y, 3);
});

it.each([
  [-1000, 4],
  [1000, 0.02],
])('clamps wheel zoom from deltaY %s to %s', async (deltaY, zoom) => {
  await wheel(0, deltaY, true);
  expect(api.getCamera().read(ComputedCamera).zoom).toBeCloseTo(zoom, 4);
});

it('moves a rotated camera with the hand tool and releases the gesture', async () => {
  await world.edit(
    api,
    (editor) => editor.gotoLandmark({ rotation: Math.PI / 2 }, { duration: 0 }),
    'NEVER',
  );
  api.setAppState({ penbarSelected: Pen.HAND });
  await world.frames();

  await world.pointer(api, 'pointerdown', 100, 100);
  await world.pointer(api, 'pointermove', 120, 100);
  const camera = api.getCamera().read(ComputedCamera);
  expect(camera.x).toBeCloseTo(0, 4);
  expect(camera.y).toBeCloseTo(-10, 4);
  await world.pointer(api, 'pointerup', 120, 100);
  expect(api.getCamera().read(ComputedCamera).y).toBeCloseTo(-10, 4);
});

it('rotates with Shift and keeps the hand-tool pivot fixed', async () => {
  api.setAppState({ penbarSelected: Pen.HAND });
  await world.frames();
  const pivot = api.viewport2Canvas({ x: 100, y: 100 });

  await world.pointer(api, 'pointerdown', 100, 100, { shiftKey: true });
  await world.pointer(api, 'pointermove', 150, 100, { shiftKey: true });
  expect(api.getCamera().read(ComputedCamera).rotation).toBeCloseTo(0.5, 4);
  const after = api.canvas2Viewport(pivot);
  expect(after.x).toBeCloseTo(100, 3);
  expect(after.y).toBeCloseTo(100, 3);
  await world.pointer(api, 'pointerup', 150, 100, { shiftKey: true });
  expect(api.getCamera().read(ComputedCamera).rotation).toBeCloseTo(0.5, 4);
});

it.each([
  [0, -10, 0],
  [Math.PI / 2, 0, -10],
])(
  'moves the canvas with the touch centroid at rotation %s',
  async (rotation, expectedX, expectedY) => {
    await world.edit(
      api,
      (editor) => editor.gotoLandmark({ rotation }, { duration: 0 }),
      'NEVER',
    );
    await world.frames();

    await world.edit(
      api,
      (editor) => {
        editor.getCanvas().write(Input).touchPanDeltaX = 20;
      },
      'NEVER',
    );
    await world.frames();

    const camera = api.getCamera().read(ComputedCamera);
    expect(camera.x).toBeCloseTo(expectedX, 4);
    expect(camera.y).toBeCloseTo(expectedY, 4);
  },
);

it('composes touch pan with pinch zoom in one frame', async () => {
  const pivot = api.viewport2Canvas({ x: 100, y: 100 });

  await world.edit(
    api,
    (editor) => {
      Object.assign(editor.getCanvas().write(Input), {
        wheelTrigger: true,
        ctrlKey: true,
        deltaY: -10,
        pointerViewport: [100, 100],
        touchPanDeltaX: 20,
      });
    },
    'NEVER',
  );
  await world.frames();

  const camera = api.getCamera().read(ComputedCamera);
  expect(camera.zoom).toBeGreaterThan(2);
  const after = api.canvas2Viewport(pivot);
  expect(after.x).toBeCloseTo(120, 3);
  expect(after.y).toBeCloseTo(100, 3);
});

it('preserves every wheel pan delivered before one execution', async () => {
  for (const [deltaX, deltaY] of [
    [20, -10],
    [8, 6],
    [-4, 2],
  ])
    api.getCanvasElement().dispatchEvent(
      new world.window.WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        deltaX,
        deltaY,
      }),
    );
  world.assertNoErrors();
  await world.frames();
  const camera = api.getCamera().read(ComputedCamera);
  expect(camera.x).toBeCloseTo(12, 4);
  expect(camera.y).toBeCloseTo(-1, 4);
});

type WheelStep = WheelEventInit & { deltaX: number; deltaY: number };
const dispatchWheel = (step: WheelStep) => {
  api.getCanvasElement().dispatchEvent(
    new world.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      ...step,
    }),
  );
  world.assertNoErrors();
};
const currentView = () => {
  const { x, y, zoom, rotation } = api.getCamera().read(ComputedCamera);
  return { x, y, zoom, rotation };
};
it.each([
  [
    [
      { deltaX: 20, deltaY: -10 },
      { deltaX: -4, deltaY: 6 },
    ],
  ],
  [
    [
      { deltaX: 0, deltaY: -10, ctrlKey: true, clientX: 30, clientY: 70 },
      { deltaX: 20, deltaY: 3 },
      { deltaX: 0, deltaY: 15, metaKey: true, clientX: 160, clientY: 110 },
    ],
  ],
  [
    [
      { deltaX: 0, deltaY: -1000, ctrlKey: true },
      { deltaX: 0, deltaY: 10, ctrlKey: true },
      { deltaX: 0, deltaY: 1000, ctrlKey: true },
      { deltaX: 0, deltaY: -20, ctrlKey: true },
    ],
  ],
])(
  'matches sequential execution for ordered wheel burst %j',
  async (steps: WheelStep[]) => {
    const reset = async () => {
      await world.edit(
        api,
        (e) =>
          e.gotoLandmark(
            { x: 12, y: -8, zoom: 2, rotation: Math.PI / 3 },
            { duration: 0 },
          ),
        'NEVER',
      );
      await world.frames();
    };
    await reset();
    for (const step of steps) {
      dispatchWheel(step);
      await world.frames();
    }
    const expected = currentView();
    await reset();
    const document = api.getNodes();
    steps.forEach(dispatchWheel);
    // Later keyboard updates must not rewrite the modifiers on prior samples.
    api
      .getCanvasElement()
      .dispatchEvent(
        new world.window.KeyboardEvent('keyup', {
          key: 'Control',
          bubbles: true,
        }),
      );
    await world.frames();
    const actual = currentView();
    for (const key of ['x', 'y', 'zoom', 'rotation'] as const)
      expect(actual[key]).toBeCloseTo(expected[key], 3);
    expect(api.getNodes()).toEqual(document);
    expect(api.getCanvas().read(Input).wheelSamples).toEqual([]);
    await world.frames();
    expect(currentView()).toEqual(actual);
  },
);

it('does not share pending wheel samples between canvases', async () => {
  const other = world.apis[1];
  const before = {
    x: other.getCamera().read(ComputedCamera).x,
    y: other.getCamera().read(ComputedCamera).y,
  };
  dispatchWheel({ deltaX: 10, deltaY: 20 });
  expect(api.getCanvas().read(Input).wheelSamples).toHaveLength(1);
  expect(other.getCanvas().read(Input).wheelSamples).toEqual([]);
  await world.frames();
  expect({
    x: other.getCamera().read(ComputedCamera).x,
    y: other.getCamera().read(ComputedCamera).y,
  }).toEqual(before);
});
