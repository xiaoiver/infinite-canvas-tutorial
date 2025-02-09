import { Delta } from './change';

import { AppState } from '../Canvas';
import { Change } from './change';
import { SceneElementsMap } from './elements-change';

export class AppStateChange implements Change<AppState> {
  private constructor(private readonly delta: Delta<AppState>) {}

  public static calculate<T extends AppState>(
    prevAppState: T,
    nextAppState: T,
  ): AppStateChange {
    const delta = Delta.calculate(
      prevAppState,
      nextAppState,
      undefined,
      // AppStateChange.postProcess,
    );

    return new AppStateChange(delta);
  }

  public static empty() {
    return new AppStateChange(Delta.create({}, {}));
  }

  public inverse(): AppStateChange {
    const inversedDelta = Delta.create(this.delta.inserted, this.delta.deleted);
    return new AppStateChange(inversedDelta);
  }

  public applyTo(
    appState: AppState,
    nextElements: SceneElementsMap,
  ): [AppState, boolean] {
    try {
      // const {
      //   selectedElementIds: removedSelectedElementIds = {},
      //   selectedGroupIds: removedSelectedGroupIds = {},
      // } = this.delta.deleted;

      const {
        // selectedElementIds: addedSelectedElementIds = {},
        // selectedGroupIds: addedSelectedGroupIds = {},
        // selectedLinearElementId,
        // editingLinearElementId,
        ...directlyApplicablePartial
      } = this.delta.inserted;

      // const mergedSelectedElementIds = Delta.mergeObjects(
      //   appState.selectedElementIds,
      //   addedSelectedElementIds,
      //   removedSelectedElementIds,
      // );

      // const mergedSelectedGroupIds = Delta.mergeObjects(
      //   appState.selectedGroupIds,
      //   addedSelectedGroupIds,
      //   removedSelectedGroupIds,
      // );

      // const selectedLinearElement =
      //   selectedLinearElementId && nextElements.has(selectedLinearElementId)
      //     ? new LinearElementEditor(
      //         nextElements.get(
      //           selectedLinearElementId,
      //         ) as NonDeleted<ExcalidrawLinearElement>,
      //       )
      //     : null;

      // const editingLinearElement =
      //   editingLinearElementId && nextElements.has(editingLinearElementId)
      //     ? new LinearElementEditor(
      //         nextElements.get(
      //           editingLinearElementId,
      //         ) as NonDeleted<ExcalidrawLinearElement>,
      //       )
      //     : null;

      const nextAppState = {
        ...appState,
        ...directlyApplicablePartial,
        // selectedElementIds: mergedSelectedElementIds,
        // selectedGroupIds: mergedSelectedGroupIds,
        // selectedLinearElement:
        //   typeof selectedLinearElementId !== "undefined"
        //     ? selectedLinearElement // element was either inserted or deleted
        //     : appState.selectedLinearElement, // otherwise assign what we had before
        // editingLinearElement:
        //   typeof editingLinearElementId !== "undefined"
        //     ? editingLinearElement // element was either inserted or deleted
        //     : appState.editingLinearElement, // otherwise assign what we had before
      };

      const constainsVisibleChanges = this.filterInvisibleChanges(
        appState,
        nextAppState,
        nextElements,
      );

      return [nextAppState, constainsVisibleChanges];
    } catch (e) {
      // shouldn't really happen, but just in case
      console.error(`Couldn't apply appstate change`, e);

      return [appState, false];
    }
  }

  public isEmpty(): boolean {
    return Delta.isEmpty(this.delta);
  }

  private static stripElementsProps(
    delta: Partial<AppState>,
  ): Partial<AppState> {
    // WARN: Do not remove the type-casts as they here to ensure proper type checks
    const {
      // editingGroupId,
      // selectedGroupIds,
      // selectedElementIds,
      // editingLinearElementId,
      // selectedLinearElementId,
      // croppingElementId,
      ...standaloneProps
    } = delta;

    return standaloneProps;
  }

  private static stripStandaloneProps(
    delta: Partial<AppState>,
  ): Partial<AppState> {
    // WARN: Do not remove the type-casts as they here to ensure proper type checks
    const {
      // name, viewBackgroundColor,
      ...elementsProps
    } = delta;

    return elementsProps;
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
    // TODO: #7348 we could still get an empty undo/redo, as we assume that previous appstate does not contain references to deleted elements
    // which is not always true - i.e. now we do cleanup appstate during history, but we do not do it during remote updates
    const prevObservedAppState = prevAppState;
    const nextObservedAppState = nextAppState;

    const containsStandaloneDifference = Delta.isRightDifferent(
      AppStateChange.stripElementsProps(prevObservedAppState),
      AppStateChange.stripElementsProps(nextObservedAppState),
    );

    const containsElementsDifference = Delta.isRightDifferent(
      AppStateChange.stripStandaloneProps(prevObservedAppState),
      AppStateChange.stripStandaloneProps(nextObservedAppState),
    );

    if (!containsStandaloneDifference && !containsElementsDifference) {
      // no change in appstate was detected
      return false;
    }

    const visibleDifferenceFlag = {
      value: containsStandaloneDifference,
    };

    return visibleDifferenceFlag.value;
  }
}
