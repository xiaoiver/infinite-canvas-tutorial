import {
  Camera3D,
  ComputedCamera,
  Input,
  Pen,
  type API,
} from '../../packages/ecs/src';
import { camera3DPlanePoint } from '../../packages/ecs/src/utils/isometric-navigation';
import { createSelectionWorld } from '../helpers/ecs-selection';

let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;

const view = () => api.getCanvas().read(Camera3D);
const ground = (x = 100, y = 100) =>
  camera3DPlanePoint(view(), [x, y], 200, 200)!;

beforeAll(async () => {
  world = await createSelectionWorld();
  [api] = world.apis;
});

beforeEach(async () => {
  await world.edit(
    api,
    (editor) => {
      editor.gotoLandmark(
        { x: 0, y: 0, zoom: 1, rotation: 0 },
        { duration: 0 },
      );
      editor.setCamera3D({
        preset: 'isometric',
        center: [0, 0, 0],
        distance: 500,
        orthographicHeight: 200,
      });
      editor.setAppState({ penbarSelected: Pen.SELECT });
    },
    'NEVER',
  );
  await world.frames();
});

afterAll(async () => {
  await world?.dispose();
});

async function wheel(
  deltaX: number,
  deltaY: number,
  options: WheelEventInit = {},
) {
  api.getCanvasElement().dispatchEvent(
    new world.window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      deltaX,
      deltaY,
      ...options,
    }),
  );
  world.assertNoErrors();
  await world.frames();
}

it.each([{}, { ctrlKey: true }, { metaKey: true }])(
  'zooms an isometric camera around the pointer for wheel modifiers %p',
  async (options) => {
    const anchor = ground();
    await wheel(0, -20, options);
    expect(view().orthographicHeight).toBeLessThan(200);
    expect(api.getCamera().read(ComputedCamera).zoom).toBeCloseTo(1);
    expect(ground()[0]).toBeCloseTo(anchor[0], 3);
    expect(ground()[1]).toBeCloseTo(anchor[1], 3);
  },
);

it('pans with the hand tool while preserving the 2D camera', async () => {
  api.setAppState({ penbarSelected: Pen.HAND });
  await world.frames();
  const anchor = ground();
  await world.pointer(api, 'pointerdown', 100, 100);
  await world.pointer(api, 'pointermove', 120, 110);
  expect(ground(120, 110)[0]).toBeCloseTo(anchor[0], 3);
  expect(ground(120, 110)[1]).toBeCloseTo(anchor[1], 3);
  expect(api.getCamera().read(ComputedCamera).x).toBeCloseTo(0);
  await world.pointer(api, 'pointerup', 120, 110);
});

it('orbits only the 3D camera with Shift + hand drag', async () => {
  api.setAppState({ penbarSelected: Pen.HAND });
  await world.frames();
  const eye = [...view().eye];
  const radius = Math.hypot(...view().eye);
  await world.pointer(api, 'pointerdown', 100, 100, { shiftKey: true });
  await world.pointer(api, 'pointermove', 140, 115, { shiftKey: true });
  expect(view().eye).not.toEqual(eye);
  expect(Math.hypot(...view().eye)).toBeCloseTo(radius, 3);
  expect(api.getCamera().read(ComputedCamera).rotation).toBeCloseTo(0);
  await world.pointer(api, 'pointerup', 140, 115, { shiftKey: true });
});

it.each([
  { deltaX: 0, deltaY: 20, options: { shiftKey: true } },
  { deltaX: 20, deltaY: 0, options: {} },
])(
  'pans with a trackpad or Shift + wheel: %p',
  async ({ deltaX, deltaY, options }) => {
    const height = view().orthographicHeight;
    const center = [...view().center];
    await wheel(deltaX, deltaY, options);
    expect(view().orthographicHeight).toBe(height);
    expect(view().center).not.toEqual(center);
    expect(api.getCamera().read(ComputedCamera).x).toBeCloseTo(0);
  },
);

it('composes touch pan and pinch zoom in one frame', async () => {
  const center = [...view().center];
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
  expect(view().orthographicHeight).toBeLessThan(200);
  expect(view().center).not.toEqual(center);
});

it('keeps linked orthographic cameras on the original 2D input path', async () => {
  await world.edit(
    api,
    (editor) =>
      editor.setCamera3D({ linked: true, projection: 'orthographic' }),
    'NEVER',
  );
  await world.frames();
  await wheel(20, 0);
  expect(api.getCamera().read(ComputedCamera).x).toBeCloseTo(20);
});

it('replays 3D wheel modes and pivots in receipt order before a frame', async () => {
  const steps: WheelEventInit[] = [
    { deltaY: -20, ctrlKey: true, clientX: 60, clientY: 80 },
    { deltaX: 20, deltaY: 5, shiftKey: true, clientX: 100, clientY: 120 },
    { deltaY: 10, metaKey: true, clientX: 140, clientY: 60 },
  ];
  const dispatch = (step: WheelEventInit) =>
    api
      .getCanvasElement()
      .dispatchEvent(
        new world.window.WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ...step,
        }),
      );
  for (const step of steps) {
    dispatch(step);
    await world.frames();
  }
  const expected = {
    center: [...view().center],
    eye: [...view().eye],
    height: view().orthographicHeight,
  };
  await world.edit(
    api,
    (e) =>
      e.setCamera3D({
        preset: 'isometric',
        center: [0, 0, 0],
        distance: 500,
        orthographicHeight: 200,
      }),
    'NEVER',
  );
  await world.frames();
  steps.forEach(dispatch);
  await world.frames();
  expect(view().orthographicHeight).toBeCloseTo(expected.height, 3);
  for (let i = 0; i < 3; i++) {
    expect(view().center[i]).toBeCloseTo(expected.center[i], 3);
    expect(view().eye[i]).toBeCloseTo(expected.eye[i], 3);
  }
  expect(api.getCanvas().read(Input).wheelSamples).toEqual([]);
});
