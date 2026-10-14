import {
  AnimationPlayer,
  FillLayers,
  Opacity,
  Path,
  Stroke,
  StrokeLayers,
  Transform,
  type API,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let left: API;
let right: API;
let now = 1000;
let clock: jest.SpyInstance;
const rect = (patch: Partial<RectSerializedNode> = {}): RectSerializedNode => ({
  id: 'shape',
  type: 'rect',
  version: 1,
  zIndex: 0,
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  fills: [{ type: 'solid', value: 'red' }],
  animation: {
    keyframes: [{ x: 0 }, { x: 100 }],
    options: { duration: 1000, fill: 'both' },
  },
  ...patch,
});
const entity = (api = left) => api.getEntity(api.getNodeById('shape'));
const controller = (api = left) =>
  entity(api).read(AnimationPlayer).controller!;
const x = (api = left) => entity(api).read(Transform).translation.x;
async function frame(dt = 0) {
  now += dt;
  await world.frame();
}
async function edit(api: API, callback: (api: API) => void) {
  await world.edit(api, callback, 'NEVER');
  await frame();
}
async function scrub(api: API, time: number) {
  await edit(api, (editor) => {
    editor.setAnimationEditing(true);
    editor.setAnimationCurrentTime(time);
  });
}
beforeAll(async () => {
  clock = jest.spyOn(performance, 'now').mockImplementation(() => now);
  world = await createDocumentWorld(2);
  [left, right] = world.apis;
});
beforeEach(async () => {
  now += 10000;
  for (const api of world.apis) {
    await world.reset(api, []);
    await edit(api, (editor) =>
      editor.setAppState({
        animationEditing: false,
        animationPlaying: false,
        animationCurrentTime: 0,
        animationLoop: false,
      }),
    );
  }
});
afterAll(async () => {
  try {
    await world?.dispose();
  } finally {
    clock?.mockRestore();
  }
});

it('scrubs one canvas while the other continues its own autoplay', async () => {
  await world.reset(left, [rect()]);
  await world.reset(right, [rect()]);
  await scrub(left, 600);
  expect(x()).toBeCloseTo(60);
  expect(x(right)).toBeCloseTo(0);
  await frame(200);
  expect(x()).toBeCloseTo(60);
  expect(x(right)).toBeCloseTo(20);
  expect(controller(right).getPlayState()).toBe('running');
});

it('uses only its own tracks to determine when a canvas timeline finishes', async () => {
  await world.reset(left, [rect()]);
  await world.reset(right, [
    rect({
      animation: {
        keyframes: [{ x: 0 }, { x: 100 }],
        options: { duration: 5000, fill: 'both' },
      },
    }),
  ]);
  await scrub(left, 900);
  await edit(left, (api) => api.playAnimation());
  await frame(200);
  expect(left.getAppState().animationCurrentTime).toBe(1000);
  expect(left.getAppState().animationPlaying).toBe(false);
  expect(x()).toBeCloseTo(100);
  expect(x(right)).toBeCloseTo(4);
});

it('keeps two paused playheads independent, including nested nodes', async () => {
  await world.reset(left, [rect()]);
  await world.reset(right, [
    { id: 'group', type: 'g', zIndex: 0, x: 0, y: 0, width: 0, height: 0 },
    rect({ parentId: 'group' }),
  ]);
  await scrub(left, 250);
  await scrub(right, 750);
  await frame(100);
  expect(x()).toBeCloseTo(25);
  expect(x(right)).toBeCloseTo(75);
});

it('applies a color and its opacity together without discarding layer metadata', async () => {
  await world.reset(left, [
    rect({
      fills: [
        { type: 'solid', value: 'green', enabled: false },
        { type: 'solid', value: 'red', opacity: 0.8 },
        { type: 'solid', value: 'blue', opacity: 0.3 },
      ],
      animation: {
        keyframes: [
          { fill: 'red', fillOpacity: 0.2 },
          { fill: 'blue', fillOpacity: 0.6 },
        ],
        options: { duration: 1000, fill: 'both' },
      },
    }),
  ]);
  await scrub(left, 500);
  expect(entity().read(FillLayers).layers).toEqual([
    { type: 'solid', value: 'green', enabled: false },
    { type: 'solid', value: 'rgba(128, 0, 128, 1)', opacity: 0.4 },
    { type: 'solid', value: 'blue', opacity: 0.3 },
  ]);
});

it('resumes autoplay from the scrubbed position without counting editor wall time', async () => {
  await world.reset(left, [rect()]);
  await frame(100);
  await scrub(left, 600);
  expect(controller().getPlayState()).toBe('paused');
  await frame(5000);
  await edit(left, (api) => api.setAnimationEditing(false));
  expect(x()).toBeCloseTo(60);
  expect(controller().getPlayState()).toBe('running');
  await frame(100);
  expect(x()).toBeCloseTo(70);
});

it('does not resume a controller paused by the caller before editing', async () => {
  await world.reset(left, [rect()]);
  controller().pause();
  await scrub(left, 500);
  await edit(left, (api) => api.setAnimationEditing(false));
  await frame(200);
  expect(controller().getPlayState()).toBe('paused');
  expect(x()).toBeCloseTo(50);
});

it('does not restart a controller cancelled while its editor is active', async () => {
  await world.reset(left, [rect()]);
  await scrub(left, 500);
  controller().cancel();
  await frame();
  await edit(left, (api) => api.setAnimationEditing(false));
  expect(controller().getPlayState()).toBe('cancelled');
});

it('loops with the overflow preserved and ignores time spent paused', async () => {
  await world.reset(left, [rect()]);
  await scrub(left, 900);
  await edit(left, (api) => {
    api.setAnimationLoop(true);
    api.playAnimation();
  });
  await frame(250);
  expect(left.getAppState().animationCurrentTime).toBe(150);
  expect(x()).toBeCloseTo(15);
  await edit(left, (api) => api.pauseAnimation());
  // No frames arrive during a suspended tab or a long user pause.
  now += 10000;
  await edit(left, (api) => api.playAnimation());
  expect(left.getAppState().animationCurrentTime).toBe(150);
  await frame(100);
  expect(x()).toBeCloseTo(25);
});

it('never moves a playing scene backwards when the wall clock regresses', async () => {
  await world.reset(left, [rect()]);
  await scrub(left, 250);
  await edit(left, (api) => api.playAnimation());
  await frame(-100);
  expect(left.getAppState().animationCurrentTime).toBe(250);
});

it.each([NaN, -100])(
  'samples invalid editor time %s at the beginning',
  async (time) => {
    await world.reset(left, [rect()]);
    await edit(left, (api) =>
      api.setAppState({ animationEditing: true, animationCurrentTime: time }),
    );
    expect(x()).toBe(0);
  },
);

it('samples both tracks but ends at the longest delayed track on the same canvas', async () => {
  await world.reset(left, [
    rect(),
    rect({
      id: 'long',
      zIndex: 1,
      animation: {
        keyframes: [{ x: 0 }, { x: 100 }],
        options: { duration: 1000, delay: 200, iterations: 2, fill: 'both' },
      },
    }),
  ]);
  expect(left.getSceneAnimationDuration()).toBe(2200);
  await scrub(left, 1900);
  expect(x()).toBe(100);
  await edit(left, (api) => api.playAnimation());
  await frame(400);
  expect(left.getAppState().animationCurrentTime).toBe(2200);
  expect(left.getAppState().animationPlaying).toBe(false);
});

it('starts a newly attached controller in editor mode and resumes it on exit', async () => {
  await scrub(left, 500);
  await world.reset(left, [rect()]);
  expect(controller().getPlayState()).toBe('paused');
  expect(x()).toBe(50);
  await edit(left, (api) => api.setAnimationEditing(false));
  await frame(100);
  expect(x()).toBeCloseTo(60);
});

it('can sample entities without a controller and an empty playing scene', async () => {
  await world.reset(left, [rect({ animation: undefined })]);
  await edit(left, () => entity().add(AnimationPlayer, new AnimationPlayer()));
  await scrub(left, 400);
  await edit(left, (api) => api.playAnimation());
  await frame(100);
  expect(x()).toBe(0);
  expect(entity().read(AnimationPlayer).controller).toBeNull();
  await edit(left, (api) => api.setAnimationEditing(false));
});

it('skips pre-delay values when there is no backwards fill', async () => {
  await world.reset(left, [
    rect({
      x: 12,
      animation: {
        keyframes: [{ x: 30 }, { x: 100 }],
        options: { duration: 1000, delay: 200, fill: 'none' },
      },
    }),
  ]);
  await scrub(left, 100);
  expect(x()).toBe(12);
  await scrub(left, 200);
  expect(x()).toBe(30);
});

it('applies independent transform axes, opacity and stroke geometry', async () => {
  const values = {
    x: 20,
    y: 30,
    scale: 2,
    scaleX: -3,
    rotation: 0.5,
    opacity: 0.6,
    stroke: 'blue',
    strokeOpacity: 0.4,
    strokeWidth: 5,
    strokeDasharray: [8, 4],
    strokeDashoffset: 7,
  };
  await world.reset(left, [
    rect({ animation: { keyframes: [values], options: { duration: 1000 } } }),
  ]);
  await scrub(left, 500);
  const transform = entity().read(Transform);
  expect([
    transform.translation.x,
    transform.translation.y,
    transform.scale.x,
    transform.scale.y,
    transform.rotation,
  ]).toEqual([20, 30, -3, 2, 0.5]);
  expect(entity().read(Opacity).opacity).toBeCloseTo(0.6);
  expect(entity().read(Stroke)).toMatchObject({
    width: 5,
    dashoffset: 7,
  });
  expect([
    entity().read(Stroke).dasharray[0],
    entity().read(Stroke).dasharray[1],
  ]).toEqual([8, 4]);
  expect(entity().read(StrokeLayers).layers).toEqual([
    { type: 'solid', value: 'blue', opacity: 0.4 },
  ]);
});

it('retains the world pivot across successive scrub positions when only scale and rotation animate', async () => {
  await world.reset(left, [
    rect({
      x: 30,
      y: 40,
      animation: {
        keyframes: [
          { scale: 1, rotation: 0 },
          { scale: 2, rotation: Math.PI },
        ],
        options: {
          duration: 1000,
          fill: 'both',
          transformOrigin: { x: 10, y: 20 },
        },
      },
    }),
  ]);
  for (const time of [250, 500, 1000, 0]) {
    await scrub(left, time);
    const t = entity().read(Transform),
      c = Math.cos(t.rotation),
      s = Math.sin(t.rotation);
    expect(
      t.translation.x + 10 * t.scale.x * c - 20 * t.scale.y * s,
    ).toBeCloseTo(40, 4);
    expect(
      t.translation.y + 10 * t.scale.x * s + 20 * t.scale.y * c,
    ).toBeCloseTo(60, 4);
  }
});

it('uses keyframed position when a pivot and both position axes are animated', async () => {
  await world.reset(left, [
    rect({
      animation: {
        keyframes: [
          { x: 0, y: 0, scaleY: 1 },
          { x: 100, y: 80, scaleY: 2 },
        ],
        options: {
          duration: 1000,
          fill: 'both',
          transformOrigin: { x: 10, y: 20 },
        },
      },
    }),
  ]);
  await scrub(left, 500);
  const t = entity().read(Transform);
  expect([t.translation.x, t.translation.y, t.scale.x, t.scale.y]).toEqual([
    50, 40, 1, 1.5,
  ]);
});

it('ignores nonfinite numeric properties and malformed dash arrays', async () => {
  await world.reset(left, [
    rect({
      x: 10,
      y: 20,
      animation: {
        keyframes: [
          {
            x: NaN,
            y: Infinity,
            scale: NaN,
            rotation: NaN,
            opacity: NaN,
            strokeWidth: NaN,
            strokeDasharray: [4, NaN],
          },
        ],
        options: { duration: 1000, fill: 'both' },
      },
    }),
  ]);
  await scrub(left, 500);
  const t = entity().read(Transform);
  expect([
    t.translation.x,
    t.translation.y,
    t.scale.x,
    t.scale.y,
    t.rotation,
  ]).toEqual([10, 20, 1, 1, 0]);
});

it('preserves stroke layers while switching the animated paint to a gradient', async () => {
  const gradient = 'linear-gradient(90deg, red, blue)';
  await world.reset(left, [
    rect({
      strokes: [
        { type: 'solid', value: 'green', enabled: false },
        { type: 'solid', value: 'red', opacity: 0.2 },
        { type: 'solid', value: 'blue' },
      ],
      animation: {
        keyframes: [{ stroke: gradient, strokeOpacity: 0.4, dashoffset: 8 }],
        options: { duration: 1000 },
      },
    }),
  ]);
  await scrub(left, 500);
  expect(entity().read(StrokeLayers).layers).toEqual([
    { type: 'solid', value: 'green', enabled: false },
    { type: 'gradient', value: gradient, opacity: 0.4 },
    { type: 'solid', value: 'blue' },
  ]);
  expect(entity().read(Stroke).dashoffset).toBe(8);
});

it('appends an animated fill without enabling or replacing disabled layers', async () => {
  const disabled = { type: 'solid' as const, value: 'blue', enabled: false };
  await world.reset(left, [
    rect({
      fills: [disabled],
      animation: {
        keyframes: [
          { fill: 'linear-gradient(0deg, red, blue)', fillOpacity: 0.5 },
        ],
        options: { duration: 1000 },
      },
    }),
  ]);
  await scrub(left, 500);
  expect(entity().read(FillLayers).layers).toEqual([
    disabled,
    {
      type: 'gradient',
      value: 'linear-gradient(0deg, red, blue)',
      opacity: 0.5,
    },
  ]);
});

it('updates layer opacity without changing paint, and leaves empty layers alone', async () => {
  await world.reset(left, [
    rect({
      strokes: [],
      animation: {
        keyframes: [{ fillOpacity: 0.25, strokeOpacity: 0.5 }],
        options: { duration: 1000 },
      },
    }),
  ]);
  await scrub(left, 500);
  expect(entity().read(FillLayers).layers).toEqual([
    { type: 'solid', value: 'red', opacity: 0.25 },
  ]);
  expect(entity().has(StrokeLayers)).toBe(false);
});

it('adds default stroke geometry when a stroke paint first appears', async () => {
  await world.reset(left, [rect({ animation: undefined })]);
  await edit(left, () => {
    if (entity().has(Stroke)) entity().remove(Stroke);
    if (entity().has(StrokeLayers)) entity().remove(StrokeLayers);
    left.animate('shape', [{ stroke: 'red' }], { duration: 1000 });
  });
  expect(entity().read(Stroke).width).toBe(1);
  expect(entity().read(StrokeLayers).layers).toEqual([
    { type: 'solid', value: 'red' },
  ]);
});

it('normalizes animated path geometry and its translation together', async () => {
  await world.reset(left, [
    {
      id: 'shape',
      type: 'path',
      version: 1,
      zIndex: 0,
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      d: 'M0 0L20 20',
      animation: {
        keyframes: [{ d: 'M10 20L30 40' }],
        options: { duration: 1000 },
      },
    },
  ]);
  await scrub(left, 500);
  expect([
    entity().read(Transform).translation.x,
    entity().read(Transform).translation.y,
  ]).toEqual([10, 20]);
  expect(entity().read(Path).d).toBe('M0 0L20 20');
});
