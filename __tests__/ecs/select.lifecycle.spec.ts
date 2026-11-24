import { JSDOM } from 'jsdom';
import { ResourceScope } from '../../packages/ecs/src/resources/ResourceScope';
import {
  Select,
  Camera,
  Canvas,
  Input,
  Pen,
  Transformable,
  DOMAdapter,
} from '../../packages/ecs/src';

jest.mock('../../packages/ecs/src/utils', () => ({
  ...jest.requireActual('../../packages/ecs/src/utils'),
  isBrowser: true,
}));

// Retain the current camera query explicitly: API cleanup can run before Becsy
// settles that query. The actual Select body and ResourceScope handle the frame.
let previous: ReturnType<typeof DOMAdapter.get>;
let dom: JSDOM;
let system: any;
const owners: ResourceScope[] = [];
beforeEach(() => {
  previous = DOMAdapter.get();
  dom = new JSDOM();
  DOMAdapter.set({
    ...previous,
    getDocument: () => dom.window.document,
  } as any);
  system = Object.create(Select.prototype);
  system.selections = new Map();
  system.vectorFillEditor = { clear: jest.fn(), update: jest.fn(() => true) };
  system.cameras = { current: [] };
});
afterEach(() => {
  owners.splice(0).forEach((scope) => scope.dispose());
  DOMAdapter.set(previous);
  dom.window.close();
});
function owner(id: number, disposed = false) {
  const scope = new ResourceScope();
  owners.push(scope);
  if (disposed) scope.dispose();
  const overlay = dom.window.document.createElement('div');
  dom.window.document.body.append(overlay);
  const history = new Set<() => void>();
  const input = { pointerDownTrigger: false };
  const api = {
    getAppState: () => ({
      penbarSelected: Pen.SELECT,
      layersCropping: [],
      vectorNetworkSelectedVertex: null,
    }),
    getNodes: () => [],
    onBeforeHistoryChange(callback: () => void) {
      history.add(callback);
      return scope.add(() => history.delete(callback));
    },
    onDestroy: (cleanup: () => void) => scope.add(cleanup),
    getSvgLayer: jest.fn(() => overlay),
  };
  const canvas = {
    read: (type: unknown) =>
      type === Canvas ? { inputPoints: [], api } : type === Input ? input : {},
    write: () => ({ value: 'default' }),
  };
  const camera = {
    __id: id,
    has: () => true,
    read: (type: unknown) =>
      type === Camera
        ? { canvas }
        : type === Transformable
        ? { selecteds: [], selectedControlPointIndex: -1 }
        : {},
  };
  return { scope, overlay, history, input, api, camera };
}
it('does not append overlays or consume input when onDestroy immediately removes a new selection', () => {
  const closed = owner(1, true);
  system.cameras.current = [closed.camera];
  for (let i = 0; i < 3; i++) expect(() => system.execute()).not.toThrow();
  expect(system.selections.size).toBe(0);
  expect(closed.overlay.children).toHaveLength(0);
  expect(closed.api.getSvgLayer).not.toHaveBeenCalled();
  expect(closed.history.size).toBe(0);
  expect(system.vectorFillEditor.update).not.toHaveBeenCalled();
});
it('keeps a destroyed initialized camera inert through pending query frames', () => {
  const closed = owner(1);
  system.cameras.current = [closed.camera];
  system.execute();
  expect(closed.overlay.children).toHaveLength(3);
  expect(closed.history.size).toBe(1);
  closed.scope.dispose();
  for (let i = 0; i < 3; i++) expect(() => system.execute()).not.toThrow();
  expect(system.selections.size).toBe(0);
  expect(closed.overlay.children).toHaveLength(0);
  expect(closed.api.getSvgLayer).toHaveBeenCalledTimes(1);
  expect(closed.history.size).toBe(0);
  expect(system.vectorFillEditor.update).toHaveBeenCalledTimes(1);
});
it('continues processing a live peer after skipping a destroyed camera', () => {
  const closed = owner(1, true),
    live = owner(2);
  system.cameras.current = [closed.camera, live.camera];
  expect(() => system.execute()).not.toThrow();
  expect(system.vectorFillEditor.update).toHaveBeenCalledTimes(1);
  expect(system.vectorFillEditor.update).toHaveBeenCalledWith(
    live.api,
    live.input,
    [],
  );
  expect([...system.selections.keys()]).toEqual([2]);
  expect(closed.overlay.children).toHaveLength(0);
  expect(live.overlay.children).toHaveLength(3);
  expect(live.history.size).toBe(1);
  live.scope.dispose();
  expect(live.overlay.children).toHaveLength(0);
  expect(live.history.size).toBe(0);
  expect(system.selections.size).toBe(0);
});
it('creates fresh selection ownership when a camera identifier is reused', () => {
  const closed = owner(1);
  system.cameras.current = [closed.camera];
  system.execute();
  const old = system.selections.get(1);
  closed.scope.dispose();
  const replacement = owner(1);
  system.cameras.current = [replacement.camera];
  system.execute();
  expect(system.selections.get(1)).not.toBe(old);
  expect(closed.overlay.children).toHaveLength(0);
  expect(closed.history.size).toBe(0);
  expect(replacement.overlay.children).toHaveLength(3);
  expect(replacement.history.size).toBe(1);
  replacement.scope.dispose();
  expect(replacement.overlay.children).toHaveLength(0);
  expect(system.selections.size).toBe(0);
});
