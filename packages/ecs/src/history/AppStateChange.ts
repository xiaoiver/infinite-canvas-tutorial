/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L399
 */

import { AppState } from '../context';
import { API } from '../API';
import { Change } from './Change';
import { Delta } from './Delta';
import { SceneElementsMap } from './ElementsChange';

export class AppStateChange implements Change<AppState> {
  private constructor(
    private readonly delta: Delta<AppState>,
    private readonly api: API,
  ) {}

  static empty() {
    return new AppStateChange(Delta.create({}, {}), undefined);
  }

  static calculate<T extends AppState>(
    prevAppState: T,
    nextAppState: T,
    api: API,
  ): AppStateChange {
    const delta = Delta.calculate(
      prevAppState,
      nextAppState,
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
    const directlyApplicablePartial = this.delta.inserted;

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
      if (layersSelected.length > 0) {
        this.api.selectNodes(
          layersSelected
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
          false,
          false,
        );
      } else {
        this.api.deselectNodes(
          prevLayersSelected
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
        );
      }

      if (layersHighlighted.length > 0) {
        this.api.highlightNodes(
          layersHighlighted
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
          false,
          false,
        );
      } else {
        this.api.unhighlightNodes(
          prevLayersHighlighted
            .map((id) => this.api.getNodeById(id))
            .filter((node) => node !== undefined),
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
