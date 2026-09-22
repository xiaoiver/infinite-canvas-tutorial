import { World } from '../../packages/ecs/node_modules/@lastolivegames/becsy';
import { App } from '../../packages/ecs/src/App';
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
