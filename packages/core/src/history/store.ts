import { AppState, getDefaultAppState } from '../Canvas';
import { isShallowEqual } from '../utils/lang';
import { deepClone, newElementWith } from '../utils/serialize';
import { OrderedSerializedNode } from './elements-change';

export class Snapshot {
  private constructor(
    public readonly elements: Map<number, OrderedSerializedNode>,
    public readonly appState: AppState,
    public readonly meta: {
      didElementsChange: boolean;
      didAppStateChange: boolean;
      isEmpty?: boolean;
    } = {
      didElementsChange: false,
      didAppStateChange: false,
      isEmpty: false,
    },
  ) {}

  public static empty() {
    return new Snapshot(new Map(), getDefaultAppState(), {
      didElementsChange: false,
      didAppStateChange: false,
      isEmpty: true,
    });
  }

  isEmpty() {
    return this.meta.isEmpty;
  }

  /**
   * Efficiently clone the existing snapshot, only if we detected changes.
   *
   * @returns same instance if there are no changes detected, new instance otherwise.
   */
  maybeClone(
    elements: Map<number, OrderedSerializedNode> | undefined,
    appState: AppState | undefined,
  ) {
    const nextElementsSnapshot = this.maybeCreateElementsSnapshot(elements);
    const nextAppStateSnapshot = this.maybeCreateAppStateSnapshot(appState);

    let didElementsChange = false;
    let didAppStateChange = false;

    if (this.elements !== nextElementsSnapshot) {
      didElementsChange = true;
    }

    if (this.appState !== nextAppStateSnapshot) {
      didAppStateChange = true;
    }

    if (!didElementsChange && !didAppStateChange) {
      return this;
    }

    const snapshot = new Snapshot(nextElementsSnapshot, nextAppStateSnapshot, {
      didElementsChange,
      didAppStateChange,
    });

    return snapshot;
  }

  /**
   * Detect if there any changed elements.
   *
   * NOTE: we shouldn't just use `sceneVersionNonce` instead, as we need to call this before the scene updates.
   */
  private detectChangedElements(
    nextElements: Map<number, OrderedSerializedNode>,
  ) {
    if (this.elements === nextElements) {
      return false;
    }

    if (this.elements.size !== nextElements.size) {
      return true;
    }

    // loop from right to left as changes are likelier to happen on new elements
    const keys = Array.from(nextElements.keys());

    for (let i = keys.length - 1; i >= 0; i--) {
      const prev = this.elements.get(keys[i]);
      const next = nextElements.get(keys[i]);
      if (
        !prev ||
        !next ||
        prev.uid !== next.uid ||
        prev.versionNonce !== next.versionNonce
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform structural clone, cloning only elements that changed.
   */
  private createElementsSnapshot(
    nextElements: Map<number, OrderedSerializedNode>,
  ) {
    const clonedElements = new Map();

    for (const [id, prevElement] of this.elements.entries()) {
      // Clone previous elements, never delete, in case nextElements would be just a subset of previous elements
      // i.e. during collab, persist or whenenever isDeleted elements get cleared
      if (!nextElements.get(id)) {
        // When we cannot find the prev element in the next elements, we mark it as deleted
        clonedElements.set(
          id,
          newElementWith(prevElement, { isDeleted: true }),
        );
      } else {
        clonedElements.set(id, prevElement);
      }
    }

    for (const [id, nextElement] of nextElements.entries()) {
      const prevElement = clonedElements.get(id);

      // At this point our elements are reconcilled already, meaning the next element is always newer
      if (
        !prevElement || // element was added
        (prevElement && prevElement.versionNonce !== nextElement.versionNonce) // element was updated
      ) {
        clonedElements.set(id, deepClone(nextElement));
      }
    }

    return clonedElements;
  }

  private maybeCreateElementsSnapshot(
    elements: Map<number, OrderedSerializedNode> | undefined,
  ) {
    if (!elements) {
      return this.elements;
    }

    const didElementsChange = this.detectChangedElements(elements);

    if (!didElementsChange) {
      return this.elements;
    }

    const elementsSnapshot = this.createElementsSnapshot(elements);
    return elementsSnapshot;
  }

  private detectChangedAppState(nextObservedAppState: AppState) {
    return !isShallowEqual(
      this.appState,
      nextObservedAppState,
      // {
      //   selectedElementIds: isShallowEqual,
      //   selectedGroupIds: isShallowEqual,
      // }
    );
  }

  private maybeCreateAppStateSnapshot(appState: AppState | undefined) {
    if (!appState) {
      return this.appState;
    }

    // Not watching over everything from the app state, just the relevant props
    const nextAppStateSnapshot = appState;

    const didAppStateChange = this.detectChangedAppState(nextAppStateSnapshot);

    if (!didAppStateChange) {
      return this.appState;
    }

    return nextAppStateSnapshot;
  }
}
