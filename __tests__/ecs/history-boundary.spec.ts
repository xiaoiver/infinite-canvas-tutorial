import { API, DefaultStateManagement } from '../../packages/ecs/src/API';
import { Snapshot } from '../../packages/ecs/src/history/Snapshot';
import { AppStateChange } from '../../packages/ecs/src/history/AppStateChange';
import { getDefaultAppState } from '../../packages/ecs/src/context';

it('excludes transient state from snapshots while retaining document effects and selection', () => {
  const initial = getDefaultAppState();
  const baseline = Snapshot.empty().maybeClone(new Map(), initial);
  expect(baseline.isEmpty()).toBe(false);
  const transient = {
    ...initial,
    loading: true,
    loadingMessage: 'busy',
    cameraX: 20,
    layersHighlighted: ['a'],
    contextMenuVisible: true,
  };
  expect(baseline.maybeClone(new Map(), transient)).toBe(baseline);
  expect(
    AppStateChange.calculate(initial, transient, undefined).isEmpty(),
  ).toBe(true);
  const updated = { ...transient, filter: 'blur(2px)', layersSelected: ['a'] };
  const snapshot = baseline.maybeClone(new Map(), updated);
  updated.layersSelected.push('b');
  expect(snapshot.appState).toEqual({
    filter: 'blur(2px)',
    layersSelected: ['a'],
    variables: {},
  });
  const [restored] = AppStateChange.calculate(
    initial,
    { ...updated, layersSelected: ['a'] },
    undefined,
  )
    .inverse()
    .applyTo(transient, new Map());
  expect(restored.loading).toBe(true);
  expect(restored.cameraX).toBe(20);
  expect(restored.filter).toBe(initial.filter);
});

it('applies zero and partial camera updates without resetting other coordinates', () => {
  const state = new DefaultStateManagement();
  state.setAppState({
    ...state.getAppState(),
    cameraX: 80,
    cameraY: 40,
    cameraZoom: 2,
    cameraRotation: 0.5,
  });
  const api = new API(state, {} as any);
  const move = jest.spyOn(api, 'gotoLandmark').mockImplementation(() => {});
  api.setAppState({ cameraX: 0 });
  api.flushPendingTasks();
  expect(move).toHaveBeenLastCalledWith(
    { x: 0, y: 40, zoom: 2, rotation: 0.5 },
    { duration: 0 },
  );
  api.setAppState({ loading: true });
  api.flushPendingTasks();
  expect(move).toHaveBeenCalledTimes(1);
});

it('records the first edit after an empty baseline and ignores loading-only records', () => {
  const state = new DefaultStateManagement();
  const api = new API(state, {} as any);
  api.record();
  api.setAppState({ loading: true });
  api.record();
  expect(api.isUndoStackEmpty()).toBe(true);
  api.setAppState({ filter: 'blur(2px)' });
  api.record();
  expect(api.isUndoStackEmpty()).toBe(false);
});
