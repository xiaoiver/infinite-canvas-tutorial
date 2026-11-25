import { completedCameraReplay } from '../browser/fixtures/camera-replay';
import {
  inputReplay,
  float32ReplayTarget,
} from '../browser/fixtures/input-replay';
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
const setup = () => {
  let view = { x: 0, y: 0, zoom: 1 },
    time = 0;
  const target = jest.fn(() => view);
  const replay = completedCameraReplay({
    view: () => view,
    snapshot: () => 7,
    now: () => time,
  });
  const input = inputReplay(replay, target, () => time);
  return {
    input,
    replay,
    target,
    set: (v: typeof view) => {
      view = v;
    },
    advance: (n: number) => {
      time += n;
    },
  };
};
it('observes the handler target after dispatch and retains completed engine timing', async () => {
  const s = setup();
  s.input.arm();
  s.input.observe({ isTrusted: true });
  expect(s.target).not.toHaveBeenCalled();
  s.advance(2);
  s.set({ x: 20, y: 30, zoom: 2 });
  const result = s.input.take();
  await tick();
  await s.replay.run(async () => {
    s.advance(8);
  });
  const row = await result;
  expect(row.requested).toEqual({ x: 20, y: 30, zoom: 2 });
  expect(row.inputToFrameMs).toBe(10);
  expect(row.frames[0].elapsed).toBe(8);
  expect(row.input.isTrusted).toBe(true);
  expect(s.input.busy).toBe(false);
});
it('rejects synthetic events and prevents overwriting an unread capture', async () => {
  const s = setup();
  s.input.arm();
  expect(() => s.input.arm()).toThrow('busy');
  s.input.observe({ isTrusted: false });
  await expect(s.input.take()).rejects.toThrow('Trusted');
  expect(s.target).not.toHaveBeenCalled();
  s.input.arm();
  s.input.dispose();
});
it('does not read UI state after destruction before the handler microtask', async () => {
  const s = setup();
  s.input.arm();
  const result = s.input.take();
  const rejected = expect(result).rejects.toThrow('disposed');
  s.input.observe({ isTrusted: true });
  s.input.dispose();
  await tick();
  await rejected;
  expect(s.target).not.toHaveBeenCalled();
});
it('propagates a frame failure and permits a new request', async () => {
  const s = setup();
  s.input.arm();
  s.input.observe({ isTrusted: true });
  const result = s.input.take();
  const rejected = expect(result).rejects.toThrow('frame');
  await tick();
  await expect(
    s.replay.run(async () => {
      throw new Error('frame');
    }),
  ).rejects.toThrow('frame');
  await rejected;
  expect(s.input.busy).toBe(false);
  s.input.arm();
  s.input.dispose();
});

it('reads the handler target at execution completion and retains the preparation frame', async () => {
  let view = { x: 0, y: 0, zoom: 1 };
  let wanted = { ...view };
  const target = jest.fn(() => wanted);
  const replay = completedCameraReplay({ view: () => view, snapshot: () => 0 });
  const input = inputReplay(replay, target);
  input.arm();
  input.observe({ isTrusted: true });
  const result = input.take();
  await tick(); // A browser may checkpoint before the next event listener.
  expect(target).not.toHaveBeenCalled();
  wanted = { x: 10, y: 20, zoom: 2 }; // Real handler requests a late camera update.
  await replay.run(async () => {});
  view = wanted;
  await replay.run(async () => {});
  const row = await result;
  expect(row.frames).toHaveLength(2);
  expect(row.frames[0].view.zoom).toBe(1);
  expect(row.requested).toEqual(wanted);
  input.dispose();
});
it('rejects extra events rather than labeling a coalesced gesture as one input', async () => {
  const s = setup();
  s.input.arm();
  s.input.observe({ isTrusted: true });
  s.input.observe({ isTrusted: true });
  const result = s.input.take();
  const rejected = expect(result).rejects.toThrow('Multiple inputs');
  await tick();
  await s.replay.run(async () => {});
  await rejected;
  expect(s.input.busy).toBe(false);
  s.input.dispose();
});

it('normalizes only float32 camera positions without altering the UI request', () => {
  const view = { x: 5851.1232, y: -8234.456789, zoom: 0.04987654321 };
  const target = float32ReplayTarget(view);
  expect(target).toEqual({
    x: 5851.123046875,
    y: -8234.45703125,
    zoom: view.zoom,
  });
  expect(Math.abs(target.x - view.x)).toBeGreaterThan(0.0001);
  expect(view.x).toBe(5851.1232);
  expect(float32ReplayTarget({ ...view, x: view.x + 1 }).x).not.toBe(target.x);
});
