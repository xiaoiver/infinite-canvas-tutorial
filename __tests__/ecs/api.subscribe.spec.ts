import { API, DefaultStateManagement } from '../../packages/ecs/src/API';

it('publishes changes to independent subscribers alongside existing callbacks', () => {
  const api = new API(new DefaultStateManagement(), {} as any);
  api.record();
  const legacy = jest.fn();
  const first = jest.fn();
  const second = jest.fn();
  api.onchange = legacy;
  const unsubscribe = api.subscribe(first);
  api.subscribe(second);
  api.setAppState({ filter: 'blur(2px)' });
  api.record();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledWith(
    expect.objectContaining({
      appState: expect.objectContaining({ filter: 'blur(2px)' }),
    }),
    { nodesChanged: false, appStateChanged: true },
  );
  expect(legacy).toHaveBeenCalledTimes(1);
  unsubscribe();
  unsubscribe();
  api.setAppState({ filter: 'blur(4px)' });
  api.record();
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(2);
  api.destroy();
  expect(second).toHaveBeenCalledTimes(2);
});

it('treats repeated registrations independently', () => {
  const api = new API(new DefaultStateManagement(), {} as any);
  api.record();
  const listener = jest.fn();
  const unsubscribe = api.subscribe(listener);
  api.subscribe(listener);
  unsubscribe();
  api.setAppState({ filter: 'blur(2px)' });
  api.record();
  expect(listener).toHaveBeenCalledTimes(1);
  api.destroy();
});

it('notifies history availability for edits, undo, redo, and clear without document callbacks', () => {
  const api = new API(new DefaultStateManagement(), {} as any);
  api.record();
  const history = jest.fn();
  const document = jest.fn();
  api.subscribeHistory(history);
  api.subscribe(document);
  api.setAppState({ filter: 'blur(2px)' });
  api.record();
  api.setAppState({ filter: 'blur(4px)' });
  api.record();
  expect(history.mock.calls).toEqual([[{ canUndo: true, canRedo: false }]]);
  api.undo();
  api.flushPendingTasks();
  expect(api.getAppState().filter).toBe('blur(2px)');
  expect(history).toHaveBeenLastCalledWith({ canUndo: true, canRedo: true });
  api.redo();
  api.flushPendingTasks();
  expect(api.getAppState().filter).toBe('blur(4px)');
  expect(history).toHaveBeenLastCalledWith({ canUndo: true, canRedo: false });
  document.mockClear();
  api.clearHistory();
  expect(history).toHaveBeenLastCalledWith({ canUndo: false, canRedo: false });
  expect(document).not.toHaveBeenCalled();
  const snapshot = api.getHistoryState();
  api.clearHistory();
  expect(api.getHistoryState()).toBe(snapshot);
  expect(history).toHaveBeenCalledTimes(4);
  api.destroy();
});

it('disposes repeated history registrations independently and on destruction', () => {
  const api = new API(new DefaultStateManagement(), {} as any);
  api.record();
  const listener = jest.fn();
  const unsubscribe = api.subscribeHistory(listener);
  api.subscribeHistory(listener);
  unsubscribe();
  unsubscribe();
  api.setAppState({ filter: 'blur(2px)' });
  api.record();
  expect(listener).toHaveBeenCalledTimes(1);
  api.destroy();
  api.clearHistory();
  api.subscribeHistory(listener);
  expect(listener).toHaveBeenCalledTimes(1);
});
