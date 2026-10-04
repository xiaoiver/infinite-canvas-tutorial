import type {
  AppState,
  CanvasHistoryState,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { Event } from '@infinite-canvas-tutorial/webcomponents/events';

export type CanvasStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CanvasState extends Readonly<CanvasHistoryState> {
  readonly status: CanvasStatus;
  readonly error: Error | null;
  readonly api: ExtendedAPI | null;
  readonly appState: Readonly<AppState> | null;
  readonly nodes: readonly SerializedNode[];
}

const emptyState: CanvasState = Object.freeze({
  status: 'idle',
  error: null,
  api: null,
  appState: null,
  nodes: Object.freeze([]),
  canUndo: false,
  canRedo: false,
});

// Serialized nodes contain document values. Keep the comparison browser-safe:
// importing the engine at runtime would eagerly load it during SSR.
function equalValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        equalValue(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}

function snapshotNodes(
  previous: readonly SerializedNode[],
  source: readonly SerializedNode[],
): readonly SerializedNode[] {
  const byId = new Map(previous.map((node) => [node.id, node]));
  const next = source.map((node) => {
    const retained = byId.get(node.id);
    // API.updateNode mutates in place, so compare against our owned copy.
    return retained && equalValue(retained, node)
      ? retained
      : structuredClone(node);
  });
  return previous.length === next.length &&
    next.every((node, index) => node === previous[index])
    ? previous
    : next;
}

/** One store per Provider; browser resources belong to the mounted canvas. */
export function createCanvasStore() {
  let state = emptyState;
  let owner: symbol | undefined;
  let disconnect: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const apiListeners = new Set<() => void>();
  const publish = (next: CanvasState) => {
    const previousAPI = state.api;
    state = next;
    if (state.api !== previousAPI) {
      [...apiListeners].forEach((listener) => listener());
    }
    [...listeners].forEach((listener) => listener());
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => emptyState,
    /** Refresh after actions, including settings history does not observe. */
    refresh(api: ExtendedAPI) {
      if (state.api !== api) return;
      publish({
        ...state,
        appState: api.getAppState(),
        nodes: snapshotNodes(state.nodes, api.getNodes()),
        ...api.getHistoryState(),
      });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Ownership observers do not run for document or view-state updates. */
    subscribeAPI(listener: () => void) {
      apiListeners.add(listener);
      return () => {
        apiListeners.delete(listener);
      };
    },
    claim() {
      if (owner) {
        throw new Error(
          'Each CanvasProvider supports one mounted InfiniteCanvas.',
        );
      }
      const token = Symbol();
      owner = token;
      let released = false;
      publish({ ...emptyState, status: 'loading' });
      const detach = () => {
        if (released || owner !== token) return;
        disconnect?.();
        if (state !== emptyState) publish(emptyState);
      };
      return {
        /** Remove browser subscriptions while retaining this mounted owner. */
        detach,
        setStatus(
          status: Exclude<CanvasStatus, 'idle'>,
          error: Error | null = null,
        ) {
          if (released || owner !== token) return;
          if (status === 'ready' && !state.api) return;
          publish({ ...state, status, error });
        },
        attach(api: ExtendedAPI, element: HTMLElement) {
          if (released || owner !== token) return;
          const unsubscribe = api.subscribe((snapshot, changes) => {
            publish({
              ...state,
              appState: snapshot.appState,
              nodes: changes.nodesChanged
                ? snapshotNodes(state.nodes, snapshot.nodes)
                : state.nodes,
            });
          });
          const unsubscribeHistory = api.subscribeHistory((history) => {
            publish({ ...state, ...history });
          });
          const refreshAppState = () => {
            publish({ ...state, appState: api.getAppState() });
          };
          const events = [
            Event.CAMERA_ZOOM_CHANGED,
            Event.CAMERA_POSITION_CHANGED,
            Event.SELECTED_NODES_CHANGED,
          ];
          events.forEach((event) =>
            element.addEventListener(event, refreshAppState),
          );
          const reset = () => {
            unsubscribe();
            unsubscribeHistory();
            events.forEach((event) =>
              element.removeEventListener(event, refreshAppState),
            );
            disconnect = undefined;
            publish(emptyState);
          };
          const unsubscribeDestroy = api.onDestroy(reset);
          disconnect = unsubscribeDestroy;
          publish({
            status: 'loading',
            error: null,
            api,
            appState: api.getAppState(),
            nodes: snapshotNodes(state.nodes, api.getNodes()),
            ...api.getHistoryState(),
          });
        },
        release() {
          if (released) return;
          detach();
          released = true;
          if (owner !== token) return;
          owner = undefined;
        },
      };
    },
  };
}

export type CanvasStore = ReturnType<typeof createCanvasStore>;
