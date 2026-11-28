import { CanvasInitialization } from '../../packages/ecs/src/resources/CanvasInitialization';
import { SetupDevice } from '../../packages/ecs/src/systems/SetupDevice';
import { Canvas, GPUResource, Theme } from '../../packages/ecs/src/components';
import { ResourceScope } from '../../packages/ecs/src/resources/ResourceScope';

let mockQuery: any;
jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  System: class {
    query() {
      return mockQuery;
    }
  },
}));
jest.mock('../../packages/ecs/src/components', () => ({
  Canvas: class {},
  GPUResource: class {},
  Grid: class {},
  Theme: class {},
}));
jest.mock('../../packages/ecs/src/utils', () => ({ isBrowser: false }));
jest.mock('../../packages/ecs/src/resources', () => ({
  TexturePool: class {
    destroy() {}
  },
}));
jest.mock('../../packages/ecs/src/render-graph/RenderGraph', () => ({}));

function fixture() {
  const initialization = new CanvasInitialization();
  const components = new Map<any, any>();
  components.set(Canvas, {
    initialization,
    renderer: 'webgl',
    width: 100,
    height: 100,
    devicePixelRatio: 1,
    element: {},
  });
  const canvas = {
    __id: 1,
    hold: () => canvas,
    has: (type: any) => components.has(type),
    read: (type: any) => components.get(type),
    add: jest.fn((type, value) => components.set(type, value)),
  };
  mockQuery = { added: [canvas], removed: [], changed: [], current: [canvas] };
  const system = new SetupDevice();
  let resolve: (resource: any) => void;
  let reject: (reason: unknown) => void;
  const promise = new Promise<any>((r, fail) => {
    resolve = r;
    reject = fail;
  });
  jest.spyOn(system as any, 'createGPUResource').mockReturnValue(promise);
  const scope = new ResourceScope();
  const release = jest.fn();
  scope.add(release);
  const resource = { scope, swapChain: { configureSwapChain: jest.fn() } };
  return {
    system,
    canvas,
    resource,
    release,
    initialization,
    reject: (error: unknown) => reject(error),
    resolve: () => resolve(resource),
  };
}

describe('asynchronous device lifecycle', () => {
  it('attaches completed resources on the next frame with current dimensions', async () => {
    const f = fixture();
    f.system.execute();
    f.resolve();
    await Promise.resolve();
    expect(f.canvas.has(GPUResource)).toBe(false);
    f.canvas.read(Canvas).width = 200;
    mockQuery.added = [];
    f.system.execute();
    expect(f.canvas.read(GPUResource)).toBe(f.resource);
    expect(f.resource.swapChain.configureSwapChain).toHaveBeenLastCalledWith(
      200,
      100,
    );
    f.system.finalize();
    f.system.finalize();
    expect(f.release).toHaveBeenCalledTimes(1);
  });

  it.each(['remove', 'exit'])(
    'releases a late initialization after %s without attaching it',
    async (action) => {
      const f = fixture();
      f.system.execute();
      mockQuery.added = [];
      if (action === 'remove') {
        mockQuery.removed = [f.canvas];
        f.system.execute();
      } else f.system.finalize();
      f.resolve();
      await Promise.resolve();
      expect(f.canvas.has(GPUResource)).toBe(false);
      expect(f.release).toHaveBeenCalledTimes(1);
      f.system.finalize();
      expect(f.release).toHaveBeenCalledTimes(1);
    },
  );

  it('releases attached resources on removal without waiting for world exit', async () => {
    const f = fixture();
    f.system.execute();
    f.resolve();
    await Promise.resolve();
    mockQuery.added = [];
    f.system.execute();
    mockQuery.removed = [f.canvas];
    f.system.execute();
    expect(f.release).toHaveBeenCalledTimes(1);
    f.system.finalize();
    expect(f.release).toHaveBeenCalledTimes(1);
  });
});

it.each(['light', 'dark'])(
  'initializes the %s palette before GPU readiness without repeated theme writes',
  async (mode) => {
    const f = fixture();
    const colors = {
      light: { background: 'transparent', grid: '#010203' },
      dark: { background: '#102030', grid: '#405060' },
    };
    f.canvas.read(Canvas).api = {
      getAppState: () => ({ themeMode: mode, theme: { mode, colors } }),
    };
    try {
      f.system.execute();
      expect(f.canvas.read(Theme)).toEqual({ mode, colors });
      expect(f.canvas.has(GPUResource)).toBe(false);
      f.resolve();
      await Promise.resolve();
      mockQuery.added = [];
      for (let i = 0; i < 3; i++) f.system.execute();
      expect(f.canvas.read(Theme).colors).toBe(colors);
      expect(
        f.canvas.add.mock.calls.filter(([type]) => type === Theme),
      ).toHaveLength(1);
    } finally {
      f.system.finalize();
    }
  },
);

it('preserves an explicitly installed palette during GPU initialization', async () => {
  const f = fixture();
  const theme = { mode: 'dark', colors: { dark: { background: '#102030' } } };
  f.canvas.add(Theme, theme);
  f.canvas.read(Canvas).api = {
    getAppState: () => ({ themeMode: 'light', theme: { colors: {} } }),
  };
  try {
    f.system.execute();
    f.resolve();
    await Promise.resolve();
    mockQuery.added = [];
    f.system.execute();
    expect(f.canvas.read(Theme)).toBe(theme);
  } finally {
    f.system.finalize();
  }
});

it('keeps readiness pending until resources are attached in the owning execute phase', async () => {
  const f = fixture();
  let ready = false;
  const pending = f.initialization.promise.then(() => {
    ready = true;
  });
  f.system.execute();
  f.resolve();
  await Promise.resolve();
  expect(ready).toBe(false);
  mockQuery.added = [];
  f.system.execute();
  await pending;
  expect(f.canvas.has(GPUResource)).toBe(true);
  f.system.finalize();
});

it('rejects asynchronous device failures with the original cause and never attaches them', async () => {
  const f = fixture(),
    error = new Error('device rejected');
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const check = expect(f.initialization.promise).rejects.toBe(error);
    f.system.execute();
    f.reject(error);
    await check;
    mockQuery.added = [];
    f.system.execute();
    expect(f.canvas.has(GPUResource)).toBe(false);
    expect(log).toHaveBeenCalledWith(
      'Failed to initialize canvas GPU resources',
      error,
    );
  } finally {
    f.system.finalize();
    log.mockRestore();
  }
});

it('rejects attachment-time configuration failure and releases the resource exactly once', async () => {
  const f = fixture(),
    error = new Error('late resize rejected');
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const check = expect(f.initialization.promise).rejects.toBe(error);
    f.system.execute();
    f.resolve();
    await Promise.resolve();
    f.resource.swapChain.configureSwapChain.mockImplementation(() => {
      throw error;
    });
    mockQuery.added = [];
    expect(() => f.system.execute()).not.toThrow();
    await check;
    expect(f.canvas.has(GPUResource)).toBe(false);
    expect(f.release).toHaveBeenCalledTimes(1);
    f.system.execute();
    f.system.finalize();
    expect(f.release).toHaveBeenCalledTimes(1);
  } finally {
    f.system.finalize();
    log.mockRestore();
  }
});

it.each(['remove', 'exit'])(
  'rejects pending readiness on %s and ignores late success',
  async (action) => {
    const f = fixture();
    const check = expect(f.initialization.promise).rejects.toThrow(
      'destroyed before GPU',
    );
    f.system.execute();
    mockQuery.added = [];
    if (action === 'remove') {
      mockQuery.removed = [f.canvas];
      f.system.execute();
    } else f.system.finalize();
    await check;
    f.resolve();
    await Promise.resolve();
    expect(f.canvas.has(GPUResource)).toBe(false);
    expect(f.release).toHaveBeenCalledTimes(1);
    f.system.finalize();
  },
);

it('does not report a late rejection after cancellation as a live canvas failure', async () => {
  const f = fixture();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const check = expect(f.initialization.promise).rejects.toThrow(
      'destroyed before GPU',
    );
    f.system.execute();
    f.system.finalize();
    await check;
    f.reject(new Error('late failure'));
    await Promise.resolve();
    await Promise.resolve();
    expect(log).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

it('keeps the original attachment error when cleanup also fails and leaves no retry', async () => {
  const f = fixture(),
    error = new Error('attachment failed');
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const check = expect(f.initialization.promise).rejects.toBe(error);
    f.system.execute();
    f.resolve();
    await Promise.resolve();
    f.resource.swapChain.configureSwapChain.mockImplementation(() => {
      throw error;
    });
    f.release.mockImplementation(() => {
      throw new Error('release failed');
    });
    mockQuery.added = [];
    expect(() => f.system.execute()).not.toThrow();
    await check;
    f.system.execute();
    f.system.finalize();
    expect(f.release).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'Failed to release uninitialized canvas resources',
      expect.any(AggregateError),
    );
  } finally {
    f.system.finalize();
    log.mockRestore();
  }
});
