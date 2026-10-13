import { World } from '../../packages/ecs/node_modules/@lastolivegames/becsy';
import { App, type AppOptions } from '../../packages/ecs/src/App';
import { DOMAdapter } from '../../packages/ecs/src/environment';

jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  System: class {
    static group() {
      return { schedule() {} };
    }
  },
  system: () => () => {},
  World: { create: jest.fn() },
}));
jest.mock('../../packages/ecs/src/environment', () => ({
  DOMAdapter: { get: jest.fn() },
}));

function deferred() {
  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve: () => resolve() };
}

describe('App lifecycle', () => {
  let frames: Map<number, () => Promise<void>>;
  let world: { execute: jest.Mock; terminate: jest.Mock };

  beforeEach(() => {
    frames = new Map();
    let id = 0;
    (DOMAdapter.get as jest.Mock).mockReturnValue({
      requestAnimationFrame: (fn: () => Promise<void>) => {
        frames.set(++id, fn);
        return id;
      },
      cancelAnimationFrame: (frame: number) => frames.delete(frame),
    });
    world = {
      execute: jest.fn().mockResolvedValue(undefined),
      terminate: jest.fn().mockResolvedValue(undefined),
    };
    (World.create as jest.Mock).mockReset().mockResolvedValue(world);
  });

  it.each<[AppOptions | undefined, number, number]>([
    [undefined, 4194304, 4194304],
    [{}, 4194304, 4194304],
    [{ maxEntities: 1024 }, 1024, 1024],
    [{ maxLimboComponents: 8192 }, 4194304, 8192],
    [{ maxEntities: 1024, maxLimboComponents: 8192 }, 1024, 8192],
  ])(
    'starts with the requested capacity: %j',
    async (options, entities, limbo) => {
      const app = new App(options);
      try {
        await app.run();
        expect(World.create).toHaveBeenCalledWith({
          threads: 1,
          maxEntities: entities,
          maxLimboComponents: limbo,
        });
      } finally {
        await app.exit();
      }
    },
  );

  it('captures capacity at construction instead of retaining caller state', async () => {
    const options = { maxEntities: 1024, maxLimboComponents: 2048 };
    const app = new App(options);
    options.maxEntities = 0;
    options.maxLimboComponents = 0;
    try {
      await app.run();
      expect(World.create).toHaveBeenCalledWith({
        threads: 1,
        maxEntities: 1024,
        maxLimboComponents: 2048,
      });
    } finally {
      await app.exit();
    }
  });

  it.each([0, -1, 1.5, NaN, Infinity, 4194305])(
    'rejects invalid entity capacity %s before creating a World',
    (maxEntities) => {
      expect(() => new App({ maxEntities })).toThrow(/maxEntities/);
      expect(World.create).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid limbo capacity %s before creating a World',
    (maxLimboComponents) => {
      expect(() => new App({ maxLimboComponents })).toThrow(
        /maxLimboComponents/,
      );
      expect(World.create).not.toHaveBeenCalled();
    },
  );

  it('awaits the active frame and never schedules another frame after exit', async () => {
    const frame = deferred();
    world.execute.mockReturnValue(frame.promise);
    const app = new App();
    await app.run();
    const [id, tick] = [...frames][0];
    frames.delete(id);
    const running = tick();
    const exited = app.exit();
    await Promise.resolve();
    expect(world.terminate).not.toHaveBeenCalled();
    frame.resolve();
    await Promise.all([running, exited]);
    expect(frames.size).toBe(0);
    expect(world.terminate).toHaveBeenCalledTimes(1);
    await app.exit();
    expect(world.terminate).toHaveBeenCalledTimes(1);
  });

  it('shares concurrent starts and handles exit during initialization', async () => {
    const initialized = deferred();
    (World.create as jest.Mock).mockReturnValue(
      initialized.promise.then(() => world),
    );
    const app = new App();
    const starting = app.run();
    expect(app.run()).toBe(starting);
    const exiting = app.exit();
    initialized.resolve();
    await Promise.all([starting, exiting]);
    expect(World.create).toHaveBeenCalledTimes(1);
    expect(world.terminate).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    await expect(app.run()).rejects.toThrow('App has exited');
  });

  it('cancels an idle scheduled frame', async () => {
    const app = new App();
    await app.exit();
    await app.run();
    await app.exit();
    expect(frames.size).toBe(0);
    expect(world.execute).not.toHaveBeenCalled();
  });
});
