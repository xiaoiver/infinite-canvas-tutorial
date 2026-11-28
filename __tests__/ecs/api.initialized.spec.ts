import { API, DefaultStateManagement } from '../../packages/ecs/src/API';

function fixture() {
  const canvases: any[] = [];
  const commands = {
    spawn: jest.fn((props) => {
      const canvas = {
        props,
        hold: () => canvas,
        delete: jest.fn(),
        has: () => false,
      };
      canvases.push(canvas);
      return { id: () => canvas };
    }),
    execute: jest.fn(),
  };
  const api = new API(new DefaultStateManagement(), commands as any);
  api.record('NEVER');
  return { api, canvases, commands };
}

it('requires a created canvas and resolves to the API only when its device owner completes', async () => {
  const { api, canvases } = fixture();
  await expect(api.initialized).rejects.toThrow('has not been created');
  api.createCanvas({});
  let settled = false;
  const pending = api.initialized.then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  canvases[0].props.initialization.resolve();
  expect(await pending).toBe(api);
  api.destroy();
});

it('preserves the original failure for existing and later readiness callers', async () => {
  const { api, canvases } = fixture();
  api.createCanvas({});
  const error = new Error('context unavailable');
  const check = expect(api.initialized).rejects.toBe(error);
  canvases[0].props.initialization.reject(error);
  await check;
  await expect(api.initialized).rejects.toBe(error);
  api.destroy();
});

it('cancels pending readiness immediately on destruction, without needing another frame', async () => {
  const { api, canvases } = fixture();
  api.createCanvas({});
  const check = expect(api.initialized).rejects.toThrow('destroyed before GPU');
  api.destroy();
  api.destroy();
  canvases[0].props.initialization.resolve();
  await check;
  await expect(api.initialized).rejects.toThrow('destroyed before GPU');
  expect(() => api.createCanvas({})).toThrow('has been destroyed');
});

it('does not let an older canvas generation settle a newer one', async () => {
  const { api, canvases } = fixture();
  api.createCanvas({});
  const old = api.initialized;
  api.createCanvas({});
  let settled = false;
  const current = api.initialized.then((value) => {
    settled = true;
    return value;
  });
  canvases[0].props.initialization.resolve();
  expect(await old).toBe(api);
  await Promise.resolve();
  expect(settled).toBe(false);
  canvases[1].props.initialization.resolve();
  expect(await current).toBe(api);
  api.destroy();
});

it('rejects readiness with a synchronous canvas creation failure', async () => {
  const { api, commands } = fixture();
  const error = new Error('spawn failed');
  commands.spawn.mockImplementation(() => {
    throw error;
  });
  expect(() => api.createCanvas({})).toThrow(error);
  await expect(api.initialized).rejects.toBe(error);
  api.destroy();
});
