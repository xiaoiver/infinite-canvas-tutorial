/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L399
 */

import { AppState } from '../context';
import { API } from '../API';
import { Change } from './Change';
import { Delta } from './Delta';
import { SceneElementsMap } from './ElementsChange';

const NON_UNDOABLE_APP_STATE_KEYS = [
  'cameraZoom',
  'cameraX',
  'cameraY',
] as const satisfies readonly (keyof AppState)[];

const stripNonUndoableAppState = <T extends Partial<AppState>>(state: T): T => {
  const next = { ...state };
  NON_UNDOABLE_APP_STATE_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
};

export class AppStateChange implements Change<AppState> {
  private constructor(
    private readonly delta: Delta<AppState>,
    private readonly api: API,
  ) { }

  static empty() {
    return new AppStateChange(Delta.create({}, {}), undefined);
  }

  static calculate<T extends AppState>(
    prevAppState: T,
    nextAppState: T,
    api: API,
  ): AppStateChange {
    const prevFiltered = stripNonUndoableAppState(prevAppState);
    const nextFiltered = stripNonUndoableAppState(nextAppState);

    const delta = Delta.calculate(
      prevFiltered,
      nextFiltered,
      undefined,
      // AppStateChange.postProcess,
    );

    return new AppStateChange(delta, api);
  }

  // private static postProcess<T extends ObservedAppState>(
  //   deleted: Partial<T>,
  //   inserted: Partial<T>,
  // ): [Partial<T>, Partial<T>] {
  //   try {
  //     Delta.diffObjects(
  //       deleted,
  //       inserted,
  //       "selectedElementIds",
  //       // ts language server has a bit trouble resolving this, so we are giving it a little push
  //       (_) => true as ValueOf<T["selectedElementIds"]>,
  //     );
  //     Delta.diffObjects(
  //       deleted,
  //       inserted,
  //       "selectedGroupIds",
  //       (prevValue) => (prevValue ?? false) as ValueOf<T["selectedGroupIds"]>,
  //     );
  //   } catch (e) {
  //     // if postprocessing fails it does not make sense to bubble up, but let's make sure we know about it
  //     console.error(`Couldn't postprocess appstate change deltas.`);
  //   } finally {
  //     return [deleted, inserted];
  //   }
  // }

  inverse(): AppStateChange {
    const inversedDelta = Delta.create(this.delta.inserted, this.delta.deleted);
    return new AppStateChange(inversedDelta, this.api);
  }

  applyTo(
    appState: AppState,
    nextElements: SceneElementsMap,
  ): [AppState, boolean] {
    const directlyApplicablePartial = stripNonUndoableAppState(this.delta.inserted);

    const nextAppState = {
      ...appState,
      ...directlyApplicablePartial,
    };

    const constainsVisibleChanges = this.filterInvisibleChanges(
      appState,
      nextAppState,
      nextElements,
    );

    if (this.api) {
      this.api.setAppState(nextAppState);

      // reselect or rehighlight nodes
      const {
        layersHighlighted: prevLayersHighlighted,
        layersSelected: prevLayersSelected,
      } = appState;
      const { layersHighlighted, layersSelected } = nextAppState;

      // 只对 layersSelected 的差异做最小选中/取消选中
      const prevSet = new Set(prevLayersSelected);
      const nextSet = new Set(layersSelected);
      const toDeselect = prevLayersSelected.filter((id) => !nextSet.has(id));
      const toSelect = layersSelected.filter((id) => !prevSet.has(id));
      if (toDeselect.length > 0) {
        this.api.deselectNodes(
          toDeselect
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
        );
      }
      if (toSelect.length > 0) {
        this.api.selectNodes(
          toSelect
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
          false,
          false,
        );
      }

      // 只对 layersHighlighted 的差异做最小高亮/取消高亮
      const prevHighlightSet = new Set(prevLayersHighlighted);
      const nextHighlightSet = new Set(layersHighlighted);
      const toUnhighlight = prevLayersHighlighted.filter(
        (id) => !nextHighlightSet.has(id),
      );
      const toHighlight = layersHighlighted.filter(
        (id) => !prevHighlightSet.has(id),
      );
      if (toUnhighlight.length > 0) {
        this.api.unhighlightNodes(
          toUnhighlight
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
        );
      }
      if (toHighlight.length > 0) {
        this.api.highlightNodes(
          toHighlight
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
          false,
          false,
        );
      }
    }

    return [nextAppState, constainsVisibleChanges];
  }

  /**
   * Mutates `nextAppState` be filtering out state related to deleted elements.
   *
   * @returns `true` if a visible change is found, `false` otherwise.
   */
  private filterInvisibleChanges(
    prevAppState: AppState,
    nextAppState: AppState,
    nextElements: SceneElementsMap,
  ): boolean {
    return true;
  }

  isEmpty(): boolean {
    return Delta.isEmpty(this.delta);
  }
}
