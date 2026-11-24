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
  const components = new Map<any, any>();
  components.set(Canvas, {
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
  const promise = new Promise<any>((r) => {
    resolve = r;
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
