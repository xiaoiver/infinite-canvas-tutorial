import type { AppState, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import type { CanvasStore } from './store';

export interface CanvasEditOptions {
  /** Non-undoable updates still notify selectors. Default: IMMEDIATELY. */
  capture?: 'IMMEDIATELY' | 'NEVER';
}

export interface CanvasActions {
  /** Run synchronous mutations at the next ECS tick and commit once. */
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
  /** Return false if no API is attached; undo/redo run on the next ECS tick. */
  undo(): boolean;
  redo(): boolean;
  clearHistory(): boolean;
}

/** Actions read the Provider at invocation time, never capturing an old API. */
export function createCanvasActions(store: CanvasStore): CanvasActions {
  const edit: CanvasActions['edit'] = (update, options = {}) => {
    const api = store.getSnapshot().api;
    if (!api) return Promise.resolve(false);
    const capture = options.capture ?? 'IMMEDIATELY';
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      let dispose = () => {};
      const finish = (settle: () => void) => {
        if (settled) return;
        settled = true;
        dispose();
        settle();
      };
      dispose = api.onDestroy(() => finish(() => resolve(false)));
      if (settled) return;
      try {
        api.runAtNextTick(() => {
          if (settled) return;
          if (store.getSnapshot().api !== api) {
            finish(() => resolve(false));
            return;
          }
          try {
            const result: unknown = update(api);
            if (
              result &&
              typeof (result as { then?: unknown }).then === 'function'
            ) {
              // Observe a rejected Promise even though async mutators are unsupported.
              Promise.resolve(result).catch(() => {});
              throw new TypeError(
                'Canvas edits must be synchronous. Await work before edit().',
              );
            }
            if (settled || store.getSnapshot().api !== api) {
              finish(() => resolve(false));
              return;
            }
            api.record(capture);
            store.refresh(api);
            finish(() => resolve(true));
          } catch (error) {
            finish(() => reject(error));
          }
        });
      } catch (error) {
        finish(() => reject(error));
      }
    });
  };

  return {
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
    async setAppState(update, options) {
      // AppState may contain DOM/platform objects. Match API's shallow patch semantics.
      const next = typeof update === 'function' ? update : { ...update };
      return edit((api) => {
        api.setAppState(
          typeof next === 'function' ? next(api.getAppState()) : next,
          { recordDesignVariableUndo: false },
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
