import type {
  AppState,
  CanvasEditOptions,
  SerializedNode,
  LandmarkAnimationEffectTiming,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import type { CanvasStore } from './store';

export type { CanvasEditOptions } from '@infinite-canvas-tutorial/ecs';

export type CanvasCameraAnimationOptions =
  Partial<LandmarkAnimationEffectTiming>;

export interface CanvasActions {
  /** Animate zoom around the viewport center; requires a finite positive zoom. */
  zoomTo(zoom: number, options?: CanvasCameraAnimationOptions): boolean;
  /** Fit all rendered shapes; an empty scene is a no-op. Does not record history. */
  fitToScreen(options?: CanvasCameraAnimationOptions): boolean;
  /** Run synchronous mutations before derived data/rendering and commit once. */
  edit(
    update: (api: ExtendedAPI) => void,
    options?: CanvasEditOptions,
  ): Promise<boolean>;
  /** Upsert nodes; an updater reads the latest scene when the edit executes. */
  updateNodes(
    update:
      | readonly SerializedNode[]
      | ((nodes: readonly SerializedNode[]) => readonly SerializedNode[]),
    options?: CanvasEditOptions,
  ): Promise<boolean>;
  /** Delete IDs and their descendants from the latest scene. */
  deleteNodes(
    ids: readonly string[],
    options?: CanvasEditOptions,
  ): Promise<boolean>;
  /** Replace the entire document, deleting omitted IDs; undoable by default. */
  replaceDocument(
    update:
      | readonly SerializedNode[]
      | ((nodes: readonly SerializedNode[]) => readonly SerializedNode[]),
    options?: CanvasEditOptions,
  ): Promise<boolean>;
  /** Merge a patch; an updater reads the latest application state. */
  setAppState(
    update:
      | Partial<AppState>
      | ((state: Readonly<AppState>) => Partial<AppState>),
    options?: CanvasEditOptions,
  ): Promise<boolean>;
  /** Resolve IDs from the latest scene; ignore missing/deleted nodes. */
  selectNodes(
    ids: readonly string[],
    options?: CanvasEditOptions & { preserveSelection?: boolean },
  ): Promise<boolean>;
  /** Return false if no API is attached; undo/redo queue in the ECS Edit stage. */
  undo(): boolean;
  redo(): boolean;
  clearHistory(): boolean;
}

/** Actions read the Provider at invocation time, never capturing an old API. */
export function createCanvasActions(store: CanvasStore): CanvasActions {
  const edit: CanvasActions['edit'] = async (update, options = {}) => {
    const api = store.getSnapshot().api;
    const signal = options.signal;
    if (!api || signal?.aborted) return false;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const unsubscribe = store.subscribeAPI(() => {
      if (store.getSnapshot().api !== api) cancel();
    });
    try {
      const applied = await api.edit(update, {
        ...options,
        signal: controller.signal,
      });
      if (applied) store.refresh(api);
      return applied;
    } finally {
      unsubscribe();
      signal?.removeEventListener('abort', cancel);
    }
  };

  return {
    zoomTo(zoom, options) {
      const api = store.getSnapshot().api;
      if (!api) return false;
      if (!Number.isFinite(zoom) || zoom <= 0) {
        throw new RangeError('Camera zoom must be a finite positive number.');
      }
      api.zoomTo(zoom, options);
      return true;
    },
    fitToScreen(options) {
      const api = store.getSnapshot().api;
      if (!api) return false;
      api.fitToScreen(options);
      return true;
    },
    edit,
    async updateNodes(update, options) {
      const next =
        typeof update === 'function' ? update : structuredClone(update);
      return edit((api) => {
        const nodes =
          typeof next === 'function'
            ? structuredClone(next(api.getNodes()))
            : next;
        api.updateNodes([...nodes]);
      }, options);
    },
    deleteNodes(ids, options) {
      const deleted = [...ids];
      return edit((api) => {
        api.deleteNodesById(deleted);
      }, options);
    },
    async replaceDocument(update, options) {
      const next =
        typeof update === 'function' ? update : structuredClone(update);
      return edit((api) => {
        // The core validates and clones the full document before applying it.
        api.replaceDocument(
          typeof next === 'function' ? next(api.getNodes()) : next,
          'local',
        );
      }, options);
    },
    async setAppState(update, options) {
      // AppState may contain DOM/platform objects. Match API's shallow patch semantics.
      const next = typeof update === 'function' ? update : { ...update };
      return edit((api) => {
        api.setAppState(
          typeof next === 'function' ? next(api.getAppState()) : next,
        );
      }, options);
    },
    selectNodes(ids, options = {}) {
      const selected = [...ids];
      const preserveSelection = options.preserveSelection ?? false;
      return edit((api) => {
        const nodes = selected
          .map((id) => api.getNodeById(id))
          .filter((node): node is SerializedNode => !!node && !node.isDeleted);
        api.selectNodes(nodes, preserveSelection);
      }, options);
    },
    undo() {
      const api = store.getSnapshot().api;
      if (!api) return false;
      api.undo();
      return true;
    },
    redo() {
      const api = store.getSnapshot().api;
      if (!api) return false;
      api.redo();
      return true;
    },
    clearHistory() {
      const api = store.getSnapshot().api;
      if (!api) return false;
      api.clearHistory();
      return true;
    },
  };
}
