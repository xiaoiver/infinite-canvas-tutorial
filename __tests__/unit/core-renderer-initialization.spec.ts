import '../../packages/core/src';
import { WebGLDeviceContribution } from '../../packages/core/node_modules/@antv/g-device-api';
import { Renderer } from '../../packages/core/src/plugins/Renderer';

type Hook = (...args: any[]) => unknown;

function fixture() {
  const handlers: Record<string, Hook[]> = {};
  const hooks = Object.fromEntries(
    ['initAsync', 'resize', 'destroy', 'beginFrame', 'endFrame', 'render'].map(
      (name) => {
        handlers[name] = [];
        const tap = (fn: Hook) => handlers[name].push(fn);
        return [name, { tap, tapPromise: tap }];
      },
    ),
  );
  new Renderer().apply({
    hooks,
    canvas: { width: 100, height: 100 },
    renderer: 'webgl',
  } as any);
  return {
    initialize: () => handlers.initAsync[0](),
    destroy: () => handlers.destroy[0](),
  };
}
afterEach(() => jest.restoreAllMocks());

it('rejects a null context/swap chain and allows teardown after failure', async () => {
  jest
    .spyOn(WebGLDeviceContribution.prototype, 'createSwapChain')
    .mockResolvedValue(null as any);
  const f = fixture();
  await expect(f.initialize()).rejects.toThrow(
    'Unable to create canvas GPU swap chain',
  );
  expect(f.destroy).not.toThrow();
});
it('retains the device initialization error and tolerates cleanup before resources exist', async () => {
  const error = new Error('context rejected');
  jest
    .spyOn(WebGLDeviceContribution.prototype, 'createSwapChain')
    .mockRejectedValue(error);
  const f = fixture();
  await expect(f.initialize()).rejects.toBe(error);
  expect(f.destroy).not.toThrow();
});
it('owns an acquired device before the first configuration can fail', async () => {
  const error = new Error('configuration failed');
  const device = { destroy: jest.fn(), checkForLeaks: jest.fn() };
  jest
    .spyOn(WebGLDeviceContribution.prototype, 'createSwapChain')
    .mockResolvedValue({
      getDevice: () => device,
      configureSwapChain: () => {
        throw error;
      },
    } as any);
  const f = fixture();
  await expect(f.initialize()).rejects.toBe(error);
  f.destroy();
  expect(device.destroy).toHaveBeenCalledTimes(1);
  expect(device.checkForLeaks).toHaveBeenCalledTimes(1);
});

it('cancels readiness immediately and releases a late device without publishing it', async () => {
  let resolve: (value: any) => void;
  jest
    .spyOn(WebGLDeviceContribution.prototype, 'createSwapChain')
    .mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
  const device = { destroy: jest.fn(), checkForLeaks: jest.fn() },
    configureSwapChain = jest.fn();
  const f = fixture(),
    pending = f.initialize();
  const check = expect(pending).rejects.toThrow('destroyed before GPU');
  f.destroy();
  await check;
  resolve({ getDevice: () => device, configureSwapChain });
  await Promise.resolve();
  await Promise.resolve();
  expect(configureSwapChain).not.toHaveBeenCalled();
  expect(device.destroy).toHaveBeenCalledTimes(1);
  expect(device.checkForLeaks).toHaveBeenCalledTimes(1);
  f.destroy();
  expect(device.destroy).toHaveBeenCalledTimes(1);
});

it('observes a late acquisition rejection after cancellation', async () => {
  let reject: (reason: unknown) => void;
  jest
    .spyOn(WebGLDeviceContribution.prototype, 'createSwapChain')
    .mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
  const f = fixture();
  const pending = f.initialize();
  const check = expect(pending).rejects.toThrow('destroyed before GPU');
  f.destroy();
  await check;
  reject(new Error('late device rejection'));
  await Promise.resolve();
  await Promise.resolve();
  expect(f.destroy).not.toThrow();
});
