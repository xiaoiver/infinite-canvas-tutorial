import {
  createCanvasRuntime,
  type CanvasRuntimeOptions,
} from '../../packages/react/src/runtime';

const mockApps: { run: jest.Mock; exit: jest.Mock; addPlugins: jest.Mock }[] =
  [];
let mockStart: Promise<void>;
let mockExit: Promise<void>;
const mockConstructor = jest.fn();

jest.mock(
  '@infinite-canvas-tutorial/ecs',
  () => ({
    DefaultPlugins: ['default-plugin'],
    App: class {
      run = jest.fn(() => mockStart);
      exit = jest.fn(() => mockExit);
      addPlugins = jest.fn(() => this);
      constructor(options: CanvasRuntimeOptions['appOptions']) {
        mockConstructor(options);
        mockApps.push(this);
      }
    },
  }),
  { virtual: true },
);
jest.mock(
  '@infinite-canvas-tutorial/webcomponents',
  () => ({ UIPlugin: 'ui-plugin' }),
  { virtual: true },
);
jest.mock('@infinite-canvas-tutorial/webcomponents/spectrum', () => ({}), {
  virtual: true,
});

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  mockApps.length = 0;
  mockStart = Promise.resolve();
  mockExit = Promise.resolve();
  mockConstructor.mockReset();
});

it.each<[CanvasRuntimeOptions['appOptions']]>([
  [undefined],
  [{}],
  [{ maxEntities: 16384 }],
  [{ maxLimboComponents: 32768 }],
  [{ maxEntities: 16384, maxLimboComponents: 32768 }],
])('passes App options %j to the shared startup', async (appOptions) => {
  const runtime = createCanvasRuntime({ appOptions });
  await flush();
  expect(mockConstructor).not.toHaveBeenCalled();
  const left = runtime.acquire();
  const right = runtime.acquire();
  await Promise.all([left.ready, right.ready]);
  expect(mockConstructor).toHaveBeenCalledTimes(1);
  expect(mockConstructor).toHaveBeenCalledWith(appOptions ?? {});
  left.release();
  right.release();
  await flush();
});

it('snapshots capacity before acquisition and reuses it after a full shutdown', async () => {
  const appOptions = { maxEntities: 16384, maxLimboComponents: 32768 };
  const options = { appOptions };
  const runtime = createCanvasRuntime(options);
  appOptions.maxEntities = 65536;
  options.appOptions = { maxEntities: 128, maxLimboComponents: 128 };

  const first = runtime.acquire();
  await first.ready;
  first.release();
  await flush();
  appOptions.maxLimboComponents = 65536;

  const second = runtime.acquire();
  await second.ready;
  expect(mockConstructor.mock.calls).toEqual([
    [{ maxEntities: 16384, maxLimboComponents: 32768 }],
    [{ maxEntities: 16384, maxLimboComponents: 32768 }],
  ]);
  expect(mockApps[0].exit).toHaveBeenCalledTimes(1);
  second.release();
  await flush();
});

it('releases runtime ownership after all leases of a failed constructor are released', async () => {
  const error = new RangeError('invalid capacity');
  mockConstructor.mockImplementationOnce(() => {
    throw error;
  });
  const runtime = createCanvasRuntime({ appOptions: { maxEntities: 0 } });
  const left = runtime.acquire();
  const right = runtime.acquire();
  expect(left.ready).toBe(right.ready);
  await expect(left.ready).rejects.toBe(error);
  expect(mockApps).toHaveLength(0);
  left.release();
  await flush();

  const replacement = createCanvasRuntime({ appOptions: { maxEntities: 128 } });
  const blocked = replacement.acquire();
  await expect(blocked.ready).rejects.toThrow('share the same CanvasRuntime');
  blocked.release();
  right.release();
  await flush();

  const retry = replacement.acquire();
  await retry.ready;
  expect(mockConstructor).toHaveBeenLastCalledWith({ maxEntities: 128 });
  expect(mockApps).toHaveLength(1);
  retry.release();
  await flush();
  expect(mockApps[0].exit).toHaveBeenCalledTimes(1);
});

it('shares one startup and shuts down only after the last canvas releases', async () => {
  const plugin = jest.fn();
  const loadUI = jest.fn().mockResolvedValue(undefined);
  const runtime = createCanvasRuntime({ plugins: [plugin], loadUI });
  const left = runtime.acquire();
  const right = runtime.acquire();
  expect(left.ready).toBe(right.ready);
  await left.ready;
  expect(mockApps).toHaveLength(1);
  expect(loadUI).toHaveBeenCalledTimes(1);
  expect(mockApps[0].addPlugins).toHaveBeenCalledWith(
    'default-plugin',
    'ui-plugin',
    plugin,
  );
  left.release();
  left.release();
  await flush();
  expect(mockApps[0].exit).not.toHaveBeenCalled();
  right.release();
  await flush();
  expect(mockApps[0].exit).toHaveBeenCalledTimes(1);
});

it('reuses startup across StrictMode setup/cleanup/setup', async () => {
  const runtime = createCanvasRuntime();
  const first = runtime.acquire();
  first.release();
  const second = runtime.acquire();
  await second.ready;
  expect(mockApps).toHaveLength(1);
  expect(mockApps[0].exit).not.toHaveBeenCalled();
  second.release();
  await flush();
});

it('finishes initialization before exiting an early-unmounted App', async () => {
  let start!: () => void;
  mockStart = new Promise((resolve) => {
    start = resolve;
  });
  const runtime = createCanvasRuntime();
  const lease = runtime.acquire();
  await flush();
  lease.release();
  await flush();
  expect(mockApps[0].exit).not.toHaveBeenCalled();
  start();
  await lease.ready;
  await flush();
  expect(mockApps[0].exit).toHaveBeenCalledTimes(1);
});

it('waits for the previous App to exit before recreating it', async () => {
  let finishExit!: () => void;
  mockExit = new Promise((resolve) => {
    finishExit = resolve;
  });
  const runtime = createCanvasRuntime();
  const first = runtime.acquire();
  await first.ready;
  first.release();
  await flush();
  const second = runtime.acquire();
  await flush();
  expect(mockApps).toHaveLength(1);
  finishExit();
  await second.ready;
  expect(mockApps).toHaveLength(2);
  second.release();
  await flush();
});

it('rejects concurrent runtimes that would compete for global canvas queues', async () => {
  const first = createCanvasRuntime().acquire();
  await first.ready;
  const second = createCanvasRuntime().acquire();
  await expect(second.ready).rejects.toThrow('share the same CanvasRuntime');
  second.release();
  first.release();
  await flush();
});

it('can retry a failed UI load after releasing its lease', async () => {
  const loadUI = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  const runtime = createCanvasRuntime({ loadUI });
  const first = runtime.acquire();
  await expect(first.ready).rejects.toThrow('offline');
  first.release();
  await flush();
  const retry = runtime.acquire();
  await retry.ready;
  expect(mockApps).toHaveLength(1);
  retry.release();
  await flush();
});
