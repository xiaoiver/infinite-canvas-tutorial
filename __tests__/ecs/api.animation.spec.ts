import {
  type API,
  type RectSerializedNode,
  Transform,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let clock: jest.SpyInstance;
const animation = () => ({
  keyframes: [{ x: 0 }, { x: 100 }],
  options: { duration: 1000, fill: 'both' as const },
});
const node = (): RectSerializedNode => ({
  id: 'shape',
  type: 'rect',
  name: 'Animated rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  zIndex: 0,
  version: 1,
});
const snapshot = () => structuredClone(api.getNodeAnimation('shape'));
async function edit(fn: (editor: API) => void) {
  await world.edit(api, fn);
  await world.frame();
}
beforeAll(async () => {
  clock = jest.spyOn(performance, 'now').mockReturnValue(1000);
  world = await createDocumentWorld();
  [api] = world.apis;
});
beforeEach(async () => {
  await world.reset(api, [node()]);
  await world.edit(
    api,
    (editor) => {
      editor.setAnimationEditing(true);
      editor.setAnimationCurrentTime(500);
    },
    'NEVER',
  );
  api.clearHistory();
});
afterAll(async () => {
  try {
    await world?.dispose();
  } finally {
    clock?.mockRestore();
  }
});

it('adds and removes an animation through document history and live ECS components', async () => {
  expect(snapshot()).toBeNull();
  await edit((api) => api.setNodeAnimation('shape', animation()));
  const added = snapshot();
  expect(added?.options.duration).toBe(1000);
  expect(
    api.getEntity(api.getNodeById('shape')).read(Transform).translation.x,
  ).toBe(50);
  expect(api.getNodeById('shape').animation?.keyframes).toEqual(
    animation().keyframes,
  );
  await edit((api) => api.removeNodeAnimation('shape'));
  expect(snapshot()).toBeNull();
  expect(api.getAnimatedTracks()).toEqual([]);
  await world.history(api, 'undo');
  expect(snapshot()).toEqual(added);
  await world.history(api, 'undo');
  expect(snapshot()).toBeNull();
  expect(api.isUndoStackEmpty()).toBe(true);
  await world.history(api, 'redo');
  expect(snapshot()).toEqual(added);
});

const edits: [string, (api: API) => void, number, number][] = [
  [
    'options',
    (api) => api.updateNodeAnimationOptions('shape', { duration: 2000 }),
    2,
    2000,
  ],
  [
    'keyframes',
    (api) =>
      api.setNodeAnimationKeyframes('shape', [{ x: 10 }, { x: 30 }, { x: 90 }]),
    3,
    1000,
  ],
  [
    'insert',
    (api) => api.addNodeAnimationKeyframe('shape', { offset: 0.5, x: 80 }),
    3,
    1000,
  ],
  [
    'update',
    (api) => api.updateNodeAnimationKeyframe('shape', 1, { x: 200 }),
    2,
    1000,
  ],
  ['remove', (api) => api.removeNodeAnimationKeyframe('shape', 1), 1, 1000],
];
it.each(edits)(
  'records %s edits as one reversible document change',
  async (_, update, count, duration) => {
    await edit((api) => api.setNodeAnimation('shape', animation()));
    const before = snapshot();
    api.clearHistory();
    await edit(update);
    const after = snapshot();
    expect(after).not.toEqual(before);
    expect(after?.keyframes).toHaveLength(count);
    expect(after?.options.duration).toBe(duration);
    await world.history(api, 'undo');
    expect(snapshot()).toEqual(before);
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expect(snapshot()).toEqual(after);
  },
);

it('keeps invalid indices, missing nodes and absent animations out of history', async () => {
  await edit((api) => {
    api.setNodeAnimation('missing', animation());
    api.updateNodeAnimationOptions('shape', { duration: 3000 });
    api.setNodeAnimationKeyframes('shape', [{ x: 200 }]);
    api.addNodeAnimationKeyframe('shape', { x: 200 });
    api.updateNodeAnimationKeyframe('shape', 0, { x: 200 });
    api.removeNodeAnimationKeyframe('shape', 0);
  });
  expect(api.getNodeAnimationController('missing')).toBeNull();
  expect(snapshot()).toBeNull();
  expect(api.isUndoStackEmpty()).toBe(true);
  await edit((api) => api.setNodeAnimation('shape', animation()));
  const before = snapshot();
  api.clearHistory();
  await edit((api) => {
    api.updateNodeAnimationKeyframe('shape', -1, { x: 200 });
    api.updateNodeAnimationKeyframe('shape', 2, { x: 200 });
    api.removeNodeAnimationKeyframe('shape', -1);
    api.removeNodeAnimationKeyframe('shape', 2);
  });
  expect(snapshot()).toEqual(before);
  expect(api.isUndoStackEmpty()).toBe(true);
});

it('retains the last keyframe and exposes independent serialization copies', async () => {
  await edit((api) =>
    api.setNodeAnimation('shape', {
      keyframes: [{ x: 7 }],
      options: { duration: 1000 },
    }),
  );
  const before = snapshot();
  api.clearHistory();
  await edit((api) => api.removeNodeAnimationKeyframe('shape', 0));
  expect(snapshot()).toEqual(before);
  expect(api.isUndoStackEmpty()).toBe(true);
  const copy = api.getNodeAnimation('shape')!;
  copy.keyframes[0].x = 900;
  copy.options.duration = 9000;
  expect(snapshot()).toEqual(before);
});

it('lists tracks with names, distinct properties, delays and finite editor duration', async () => {
  await world.reset(api, [
    {
      ...node(),
      animation: {
        keyframes: [
          { x: 0, opacity: 0 },
          { x: 100, opacity: 1 },
        ],
        options: { duration: 500, delay: 100, iterations: 3 },
      },
    },
    {
      ...node(),
      id: 'loop',
      name: '',
      zIndex: 1,
      animation: {
        keyframes: [{ rotation: 0 }, { rotation: 1 }],
        options: { duration: 2000, delay: 200, iterations: 'infinite' },
      },
    },
    { ...node(), id: 'static', zIndex: 2 },
  ]);
  expect(api.getAnimatedTracks()).toEqual([
    {
      id: 'shape',
      name: 'Animated rectangle',
      properties: ['x', 'opacity'],
      delay: 100,
      duration: 1500,
      totalDuration: 1600,
    },
    {
      id: 'loop',
      name: 'loop',
      properties: ['rotation'],
      delay: 200,
      duration: 2000,
      totalDuration: 2200,
    },
  ]);
  expect(api.getSceneAnimationDuration()).toBe(2200);
});

it.each(['id', 'node', 'entity'] as const)(
  'animates a target supplied as %s and replaces its live controller',
  async (kind) => {
    const target =
      kind === 'id'
        ? 'shape'
        : kind === 'node'
        ? api.getNodeById('shape')
        : api.getEntity(api.getNodeById('shape'));
    await edit((api) => {
      api.animate(target, [{ x: 0 }, { x: 80 }], { duration: 1000 });
    });
    const first = api.getNodeAnimationController('shape');
    expect(first?.getCurrentValues()?.x).toBe(40);
    await edit((api) => {
      api.animate(target, [{ x: 20 }], { duration: 500 });
    });
    expect(api.getNodeAnimationController('shape')).not.toBe(first);
    expect(api.getNodeAnimationController('shape')?.getCurrentValues()?.x).toBe(
      20,
    );
  },
);

it('ignores a missing imperative target and toggles the editor transport', async () => {
  await edit((api) => {
    expect(
      api.animate('missing', [{ x: 1 }], { duration: 1000 }),
    ).toBeUndefined();
    api.setAnimationCurrentTime(-10);
    api.setAnimationLoop(true);
    api.toggleAnimationPlaying();
  });
  expect(api.getAppState()).toMatchObject({
    animationEditing: true,
    animationPlaying: true,
    animationCurrentTime: 0,
    animationLoop: true,
  });
  await edit((api) => api.toggleAnimationPlaying());
  expect(api.getAppState().animationPlaying).toBe(false);
});
