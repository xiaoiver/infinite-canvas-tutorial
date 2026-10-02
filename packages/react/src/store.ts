import type {
  AppState,
  CanvasHistoryState,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { Event } from '@infinite-canvas-tutorial/webcomponents/events';

export interface CanvasState extends Readonly<CanvasHistoryState> {
  readonly api: ExtendedAPI | null;
  readonly appState: Readonly<AppState> | null;
  readonly nodes: readonly SerializedNode[];
}

const emptyState: CanvasState = Object.freeze({
  api: null,
  appState: null,
  nodes: Object.freeze([]),
  canUndo: false,
  canRedo: false,
});

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
    /** Refresh view settings that the history snapshot does not observe. */
    refresh(api: ExtendedAPI) {
      if (state.api !== api) return;
      publish({
        ...state,
        appState: api.getAppState(),
        nodes: api.getNodes(),
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
      return {
        attach(api: ExtendedAPI, element: HTMLElement) {
          if (released || owner !== token) return;
          const unsubscribe = api.subscribe((snapshot) => {
            publish({ ...state, ...snapshot });
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
            api,
            appState: api.getAppState(),
            nodes: api.getNodes(),
            ...api.getHistoryState(),
          });
        },
        release() {
          if (released) return;
          released = true;
          if (owner !== token) return;
          disconnect?.();
          owner = undefined;
        },
      };
    },
  };
}

export type CanvasStore = ReturnType<typeof createCanvasStore>;
