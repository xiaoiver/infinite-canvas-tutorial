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
