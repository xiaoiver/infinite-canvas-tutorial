import { API, ComputedCamera, DOMAdapter } from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
beforeAll(async () => {
  world = await createDocumentWorld(2);
  [api] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
beforeEach(async () => {
  await world.reset(api, [
    { id: 'a', type: 'rect', zIndex: 0, x: 10, y: 10, width: 20, height: 20 },
  ]);
  const reset = api.setCameraView({ x: 0, y: 0, zoom: 1, rotation: 0 });
  await world.frame();
  await reset;
});
const camera = (a = api) => {
  const { x, y, zoom, rotation } = a.getCamera().read(ComputedCamera);
  return { x, y, zoom, rotation };
};
it('coalesces copied views and derives the initialized camera in the next execution without recording', async () => {
  const document = structuredClone(api.getNodes());
  const record = jest.spyOn(api, 'record');
  const changed = jest.fn(),
    collab = jest.fn();
  const unsubscribe = api.subscribe(changed);
  api.onchange = collab;
  try {
    const first = api.setCameraView({ x: 20, y: 30, zoom: 2 });
    const target = { x: 40, y: 50, zoom: 4 };
    const second = api.setCameraView(target);
    target.x = 999;
    expect(camera().x).toBe(0);
    await world.frame();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(camera()).toEqual({ x: 40, y: 50, zoom: 4, rotation: 0 });
    expect(api.getNodes()).toEqual(document);
    expect(record).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(collab).not.toHaveBeenCalled();
    expect(api.isUndoStackEmpty()).toBe(true);
  } finally {
    unsubscribe();
    record.mockRestore();
    api.onchange = undefined;
  }
});
it('keeps the order of navigation, document edits and subsequent navigation', async () => {
  const calls: number[] = [];
  const original = api.setAppState.bind(api);
  const spy = jest.spyOn(api, 'setAppState').mockImplementation((p) => {
    if (p.cameraX !== undefined) calls.push(p.cameraX);
    original(p);
  });
  try {
    const a = api.setCameraView({ x: 10, y: 0, zoom: 1 });
    const edit = api.edit((e) => {
      e.setAppState({ cameraX: 20 });
      e.updateNode(e.getNodeById('a'), { width: 30 });
    });
    const b = api.setCameraView({ x: 30, y: 0, zoom: 1 });
    const c = api.setCameraView({ x: 40, y: 0, zoom: 1 });
    await world.frame();
    expect(await Promise.all([a, edit, b, c])).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(calls.slice(0, 3)).toEqual([10, 20, 40]);
    expect(camera().x).toBe(40);
    expect(api.getNodeById('a').width).toBe(30);
  } finally {
    spy.mockRestore();
  }
});
it('defers reentrant navigation rather than overwriting a request in the active batch', async () => {
  let nested: Promise<boolean>;
  const edit = api.edit(
    (e) => {
      nested = e.setCameraView({ x: 90, y: 0, zoom: 1 });
    },
    { capture: 'NEVER' },
  );
  const current = api.setCameraView({ x: 20, y: 0, zoom: 1 });
  await world.frame();
  expect(await edit).toBe(true);
  expect(await current).toBe(true);
  expect(camera().x).toBe(20);
  await world.frame();
  expect(await nested!).toBe(true);
  expect(camera().x).toBe(90);
});
it('preserves redo and uncommitted document changes until a later record', async () => {
  await world.edit(api, (e) => e.updateNode(e.getNodeById('a'), { width: 30 }));
  await world.history(api, 'undo');
  expect(api.isRedoStackEmpty()).toBe(false);
  const original = api.record.bind(api);
  const record = jest.spyOn(api, 'record');
  // Change the live document without committing it, as editing tools do.
  await world.edit(api, (e) => {
    record.mockImplementation(() => {});
    e.updateNode(e.getNodeById('a'), { height: 35 });
  });
  record.mockImplementation(original);
  record.mockClear();
  try {
    const pending = api.setCameraView({ x: 20, y: 30, zoom: 2 });
    await world.frame();
    await pending;
    expect(record).not.toHaveBeenCalled();
    expect(api.getNodeById('a').height).toBe(35);
    expect(api.isRedoStackEmpty()).toBe(false);
    await world.edit(api, (e) => e.record());
    await world.history(api, 'undo');
    expect(api.getNodeById('a').height).toBe(20);
  } finally {
    record.mockRestore();
  }
});
it.each([
  { x: NaN, y: 0, zoom: 1 },
  { x: 0, y: Infinity, zoom: 1 },
  { x: 0, y: 0, zoom: 0 },
  { x: 0, y: 0, zoom: -1 },
  { x: 0, y: 0, zoom: 1, rotation: NaN },
  { x: Number.MAX_VALUE, y: 0, zoom: 1 },
  { x: 0, y: 0, zoom: Number.MAX_VALUE },
  { x: 0, y: 0, zoom: 1, rotation: Number.MAX_VALUE },
  null,
  { x: 0, y: 0, zoom: Number.MIN_VALUE },
])(
  'rejects invalid storage without replacing a valid pending view: %j',
  async (invalid) => {
    const valid = api.setCameraView({ x: 5, y: 6, zoom: 2 });
    await expect(api.setCameraView(invalid)).rejects.toThrow('finite');
    await world.frame();
    await valid;
    expect(camera().x).toBe(5);
  },
);
it('does not retain a failed request or prevent a following navigation', async () => {
  const spy = jest.spyOn(api, 'setAppState').mockImplementationOnce(() => {
    throw new Error('navigation failure');
  });
  const pending = api.setCameraView({ x: 10, y: 20, zoom: 2 });
  const rejection = expect(pending).rejects.toThrow('navigation failure');
  await world.frame();
  await rejection;
  spy.mockRestore();
  const next = api.setCameraView({ x: 40, y: 50, zoom: 4 });
  await world.frame();
  expect(await next).toBe(true);
  expect(camera().x).toBe(40);
});
it.each([false, true])(
  'interrupts a camera flight even for an unchanged view (changed: %s)',
  async (changed) => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    const adapter = DOMAdapter.get();
    const schedule = jest
      .spyOn(adapter, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callbacks.set(++id, callback);
        return id;
      });
    const cancel = jest
      .spyOn(adapter, 'cancelAnimationFrame')
      .mockImplementation((key) => {
        callbacks.delete(key);
      });
    try {
      await world.edit(
        api,
        (e) => e.gotoLandmark({ x: 100, y: 200, zoom: 3 }, { duration: 100 }),
        'NEVER',
      );
      expect(callbacks.size).toBe(1);
      const target = changed
        ? { x: 20, y: 30, zoom: 2 }
        : { x: 0, y: 0, zoom: 1 };
      const pending = api.setCameraView(target);
      await world.frame();
      await pending;
      expect(callbacks.size).toBe(0);
      expect(camera()).toEqual({ ...target, rotation: 0 });
    } finally {
      schedule.mockRestore();
      cancel.mockRestore();
    }
  },
);
it('preserves rotation at application when it is omitted from the view', async () => {
  const edit = api.edit((e) => e.setAppState({ cameraRotation: 0.4 }), {
    capture: 'NEVER',
  });
  const view = api.setCameraView({ x: 10, y: 20, zoom: 2 });
  await world.frame();
  await Promise.all([edit, view]);
  expect(camera().rotation).toBeCloseTo(0.4, 5);
  const explicit = api.setCameraView({ x: 10, y: 20, zoom: 2, rotation: 0 });
  await world.frame();
  await explicit;
  expect(camera().rotation).toBe(0);
});
it('retains the last supplied rotation when coalescing following pan requests', async () => {
  const rotation = api.setCameraView({ x: 10, y: 20, zoom: 2, rotation: 0.6 });
  const pan = api.setCameraView({ x: 15, y: 25, zoom: 2 });
  await world.frame();
  await Promise.all([rotation, pan]);
  expect(camera().x).toBe(15);
  expect(camera().rotation).toBeCloseTo(0.6, 5);
});
it('cancels queued views on same-frame destruction without affecting the other canvas', async () => {
  const other = world.apis[1];
  const destroy = api.edit(() => other.destroy());
  const cancelled = other.setCameraView({ x: 20, y: 30, zoom: 2 });
  const live = api.setCameraView({ x: 40, y: 50, zoom: 4 });
  await world.frame();
  expect(await destroy).toBe(true);
  expect(await cancelled).toBe(false);
  expect(await live).toBe(true);
  expect(await other.setCameraView({ x: 0, y: 0, zoom: 1 })).toBe(false);
  expect(camera().x).toBe(40);
  await world.frame();
  expect(camera().x).toBe(40);
});
