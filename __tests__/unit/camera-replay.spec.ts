import {
  completedCameraReplay,
  fixedCameraTrace,
  sameReplayView,
  validateReplayView,
} from '../browser/fixtures/camera-replay';
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};
const tick = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
it('has independent reproducible poses, including idle, precision changes and culling reentry', () => {
  for (const workload of ['strokes', 'workflow'] as const) {
    const a = fixedCameraTrace(workload),
      b = fixedCameraTrace(workload);
    expect(a).toEqual(b);
    expect(new Set(a.map((p) => p.id)).size).toBe(a.length);
    a.forEach(validateReplayView);
    expect(sameReplayView(a[0], a[1])).toBe(true);
    expect(sameReplayView(a.at(-1)!, a.at(-2)!)).toBe(true);
    expect(a.some((p) => p.id === 'offscreen' && p.x === 100000)).toBe(true);
    a[0].x = 999;
    expect(b[0].x).not.toBe(999);
  }
  for (const view of [
    { x: NaN, y: 0, zoom: 1 },
    { x: 0, y: Infinity, zoom: 1 },
    { x: 0, y: 0, zoom: 0 },
  ])
    expect(() => validateReplayView(view)).toThrow();
});
it('waits for an existing execution and records the first completed derived target frame, retaining preparation', async () => {
  let view = { x: 0, y: 0, zoom: 1 },
    time = 0;
  const before = jest.fn(),
    after = jest.fn(),
    snapshot = jest.fn(() => ({ draws: 7 }));
  const replay = completedCameraReplay({
    view: () => view,
    now: () => time,
    before,
    after,
    snapshot,
  });
  const old = deferred();
  const executing = replay.run(() => old.promise);
  const apply = jest.fn(async () => {});
  const step = replay.step({ x: 20, y: 30, zoom: 2 }, apply);
  await tick();
  expect(apply).not.toHaveBeenCalled();
  old.resolve();
  await executing;
  await tick();
  expect(apply).toHaveBeenCalledTimes(1);
  await replay.run(async () => {
    time += 3;
  });
  expect(snapshot).toHaveBeenCalledTimes(1);
  await replay.run(async () => {
    time += 8;
    view = { x: 20, y: 30, zoom: 2 };
  });
  const result = await step;
  expect(result.frames.map((f) => [f.view, f.elapsed])).toEqual([
    [{ x: 0, y: 0, zoom: 1 }, 3],
    [view, 8],
  ]);
  expect(result.operationToFrameMs).toBe(11);
  expect(before).toHaveBeenCalledTimes(2);
  expect(after).toHaveBeenCalledTimes(2);
});
it('rejects overlapping requests and disposal without reading removed state', async () => {
  const snapshot = jest.fn(() => 0);
  const replay = completedCameraReplay({
    view: () => ({ x: 0, y: 0, zoom: 1 }),
    snapshot,
  });
  const step = replay.step({ x: 1, y: 0, zoom: 1 }, async () => {});
  const rejection = expect(step).rejects.toThrow('disposed');
  await tick();
  await expect(
    replay.step({ x: 2, y: 0, zoom: 1 }, async () => {}),
  ).rejects.toThrow('busy');
  const frame = deferred();
  const executing = replay.run(() => frame.promise);
  replay.dispose();
  frame.resolve();
  await executing;
  await rejection;
  expect(snapshot).not.toHaveBeenCalled();
  await expect(
    replay.step({ x: 0, y: 0, zoom: 1 }, async () => {}),
  ).rejects.toThrow('disposed');
});
it('propagates mutation and execution failures and releases the capture for a later request', async () => {
  const after = jest.fn();
  const replay = completedCameraReplay({
    view: () => ({ x: 1, y: 0, zoom: 1 }),
    snapshot: () => 0,
    after,
  });
  await expect(
    replay.step({ x: 1, y: 0, zoom: 1 }, async () => {
      throw new Error('mutation');
    }),
  ).rejects.toThrow('mutation');
  const bad = replay.step({ x: 1, y: 0, zoom: 1 }, async () => {});
  const rejection = expect(bad).rejects.toThrow('frame');
  await tick();
  await expect(
    replay.run(async () => {
      throw new Error('frame');
    }),
  ).rejects.toThrow('frame');
  await rejection;
  expect(after).toHaveBeenCalledTimes(1);
  const good = replay.step({ x: 1, y: 0, zoom: 1 }, async () => {});
  await tick();
  await replay.run(async () => {});
  expect((await good).frames).toHaveLength(1);
});

it('rejects destruction while waiting for an earlier execution to finish', async () => {
  const old = deferred();
  const replay = completedCameraReplay({
    view: () => ({ x: 0, y: 0, zoom: 1 }),
    snapshot: () => 0,
  });
  const running = replay.run(() => old.promise);
  const apply = jest.fn(async () => {});
  const step = replay.step({ x: 1, y: 0, zoom: 1 }, apply);
  const rejection = expect(step).rejects.toThrow('disposed');
  replay.dispose();
  await rejection;
  expect(apply).not.toHaveBeenCalled();
  old.resolve();
  await running;
});

it('fails an unreachable camera within a bounded number of retained frames', async () => {
  const replay = completedCameraReplay({
    view: () => ({ x: 0, y: 0, zoom: 1 }),
    snapshot: () => 0,
    maxFrames: 2,
  });
  const step = replay.step({ x: 1, y: 0, zoom: 1 }, async () => {});
  const rejection = expect(step).rejects.toThrow('frame budget');
  await tick();
  await replay.run(async () => {});
  await replay.run(async () => {});
  await rejection;
  expect(replay.busy).toBe(false);
});
