import { API, DefaultStateManagement } from '../../packages/ecs/src/API';

function flushFrame(api: API) {
  api.flushPendingEdits();
  api.flushPendingTasks();
}

function createAPI() {
  const state = new DefaultStateManagement();
  const api = new API(state, {} as any);
  api.record('NEVER');
  return { api, state };
}

it('defers edits, reads current state, and commits a compound edit once', async () => {
  const { api } = createAPI();
  const changed = jest.fn();
  api.subscribe(changed);
  const pending = api.edit((editor) => {
    editor.setAppState({ filter: `${editor.getAppState().filter}a` });
    editor.record();
    editor.setAppState({ filter: `${editor.getAppState().filter}b` });
    editor.record('NEVER');
  });
  expect(api.getAppState().filter).toBe('');
  api.setAppState({ filter: 'blur(2px)' });
  flushFrame(api);
  expect(await pending).toBe(true);
  expect(api.getAppState().filter).toBe('blur(2px)ab');
  expect(changed).toHaveBeenCalledTimes(1);
  api.undo();
  flushFrame(api);
  expect(api.getAppState().filter).toBe('');
  expect(api.isUndoStackEmpty()).toBe(true);
  api.destroy();
});

it('keeps separate edits as separate undo steps even in one flush', async () => {
  const { api } = createAPI();
  const first = api.edit((editor) =>
    editor.setAppState({ filter: 'blur(2px)' }),
  );
  const second = api.edit((editor) =>
    editor.setAppState({ filter: 'blur(4px)' }),
  );
  flushFrame(api);
  expect(await Promise.all([first, second])).toEqual([true, true]);
  api.undo();
  flushFrame(api);
  expect(api.getAppState().filter).toBe('blur(2px)');
  api.undo();
  flushFrame(api);
  expect(api.getAppState().filter).toBe('');
  api.destroy();
});

it('publishes non-undoable edits once without notifying collaboration callbacks', async () => {
  const { api } = createAPI();
  const changed = jest.fn();
  api.subscribe(changed);
  api.onchange = jest.fn();
  const pending = api.edit(
    (editor) => {
      editor.setAppState({ filter: 'blur(2px)' });
      editor.record();
    },
    { capture: 'NEVER' },
  );
  flushFrame(api);
  expect(await pending).toBe(true);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(api.onchange).not.toHaveBeenCalled();
  expect(api.isUndoStackEmpty()).toBe(true);
  api.destroy();
});

it('settles pending and future edits when the canvas is destroyed', async () => {
  const { api } = createAPI();
  const update = jest.fn();
  const pending = api.edit(update);
  api.destroy();
  expect(await pending).toBe(false);
  expect(await api.edit(update)).toBe(false);
  flushFrame(api);
  expect(update).not.toHaveBeenCalled();
});

it('cancels queued edits without waiting for a frame and removes abort listeners', async () => {
  const { api } = createAPI();
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  const update = jest.fn();
  const pending = api.edit(update, { signal: controller.signal });
  controller.abort();
  expect(await pending).toBe(false);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(await api.edit(update, { signal: controller.signal })).toBe(false);
  flushFrame(api);
  expect(update).not.toHaveBeenCalled();
  api.destroy();
});

it('does not cancel completed edits when a signal aborts later', async () => {
  const { api } = createAPI();
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  const pending = api.edit(
    (editor) => editor.setAppState({ filter: 'blur(2px)' }),
    {
      signal: controller.signal,
    },
  );
  flushFrame(api);
  controller.abort();
  expect(await pending).toBe(true);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(api.getAppState().filter).toBe('blur(2px)');
  api.destroy();
});

it('isolates failed edits, restores commit behavior, and does not roll back mutations', async () => {
  const { api } = createAPI();
  const failed = api.edit((editor) => {
    editor.setAppState({ filter: 'blur(2px)' });
    throw new Error('invalid edit');
  });
  const check = expect(failed).rejects.toThrow('invalid edit');
  expect(() => flushFrame(api)).not.toThrow();
  await check;
  expect(api.getAppState().filter).toBe('blur(2px)');
  expect(api.isUndoStackEmpty()).toBe(true);
  api.record();
  expect(api.isUndoStackEmpty()).toBe(false);
  const next = api.edit((editor) =>
    editor.setAppState({ filter: 'blur(4px)' }),
  );
  flushFrame(api);
  expect(await next).toBe(true);
  api.destroy();
});

it('rejects asynchronous callbacks without blocking the next queued edit', async () => {
  const { api } = createAPI();
  const invoked = jest.fn();
  const failed = api.edit(async (editor) => {
    invoked();
    await Promise.resolve();
    editor.setAppState({ filter: 'blur(999px)' });
  });
  const check = expect(failed).rejects.toThrow('must be synchronous');
  const next = api.edit((editor) =>
    editor.setAppState({ filter: 'blur(2px)' }),
  );
  expect(() => flushFrame(api)).not.toThrow();
  await check;
  expect(await next).toBe(true);
  expect(invoked).not.toHaveBeenCalled();
  expect(api.getAppState().filter).toBe('blur(2px)');
  api.destroy();
});

it('rejects returned thenables and observes their rejection', async () => {
  const { api } = createAPI();
  const pending = api.edit(() =>
    Promise.reject(new Error('thenable callback')),
  );
  const check = expect(pending).rejects.toThrow('must be synchronous');
  expect(() => flushFrame(api)).not.toThrow();
  await check;
  expect(api.isUndoStackEmpty()).toBe(true);
  api.destroy();
});

it('preserves following-tick semantics for nested edits and legacy tasks', async () => {
  const { api } = createAPI();
  let nested: Promise<boolean>;
  const legacy = jest.fn();
  const first = api.edit((editor) => {
    editor.setAppState({ filter: 'blur(2px)' });
    nested = editor.edit((inner) => inner.setAppState({ filter: 'blur(4px)' }));
    editor.runAtNextTick(legacy);
  });
  flushFrame(api);
  expect(await first).toBe(true);
  expect(api.getAppState().filter).toBe('blur(2px)');
  expect(legacy).not.toHaveBeenCalled();
  flushFrame(api);
  expect(await nested!).toBe(true);
  expect(api.getAppState().filter).toBe('blur(4px)');
  expect(legacy).toHaveBeenCalledTimes(1);
  api.destroy();
});

it('settles all remaining edits if a callback destroys its canvas', async () => {
  const { api } = createAPI();
  const next = jest.fn();
  const first = api.edit((editor) => editor.destroy());
  const second = api.edit(next);
  expect(() => flushFrame(api)).not.toThrow();
  expect(await Promise.all([first, second])).toEqual([false, false]);
  expect(next).not.toHaveBeenCalled();
});

it('refreshes design-variable bindings before completion and records only once', async () => {
  const { api, state } = createAPI();
  const node = {
    id: 'bound',
    type: 'rect' as const,
    zIndex: 0,
    fills: [{ type: 'solid' as const, value: '$accent' }],
  };
  state.setNodes([node]);
  api.getEntityCommands().set(node.id, {} as any);
  const refresh = jest.spyOn(api, 'updateNode').mockImplementation(() => {});
  api.record('NEVER');
  const changed = jest.fn();
  api.subscribe(changed);
  const pending = api.edit((editor) => {
    editor.setAppState({
      variables: { accent: { type: 'color', value: '#f00' } },
    });
    editor.setAppState({
      variables: { accent: { type: 'color', value: '#0f0' } },
    });
  });
  flushFrame(api);
  expect(await pending).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenLastCalledWith(node, { fills: node.fills }, false);
  expect(changed).toHaveBeenCalledTimes(1);
  flushFrame(api);
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(changed).toHaveBeenCalledTimes(1);
  api.undo();
  flushFrame(api);
  expect(api.getAppState().variables).toEqual({});
  expect(api.isUndoStackEmpty()).toBe(true);
  api.getEntityCommands().clear();
  api.destroy();
});
