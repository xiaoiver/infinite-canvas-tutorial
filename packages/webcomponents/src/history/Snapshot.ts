import { SerializedNode, randomInteger } from '@infinite-canvas-tutorial/ecs';
import { AppState, getDefaultAppState } from '../context';
import { isShallowEqual } from './Delta';
import { getUpdatedTimestamp } from '../utils';

type OrderedExcalidrawElement = SerializedNode;
type ObservedAppState = AppState;

export class Snapshot {
  private constructor(
    public readonly elements: Map<string, SerializedNode>,
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

  static empty() {
    return new Snapshot(new Map(), getDefaultAppState(), {
      didElementsChange: false,
      didAppStateChange: false,
      isEmpty: true,
    });
  }
  // public isEmpty() {
  //   return this.meta.isEmpty;
  // }
  /**
   * Efficiently clone the existing snapshot, only if we detected changes.
   *
   * @returns same instance if there are no changes detected, new instance otherwise.
   */
  public maybeClone(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
    appState: AppState | ObservedAppState | undefined,
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

  private maybeCreateAppStateSnapshot(
    appState: AppState | ObservedAppState | undefined,
  ) {
    if (!appState) {
      return this.appState;
    }
    // Not watching over everything from the app state, just the relevant props
    // const nextAppStateSnapshot = !isObservedAppState(appState)
    //   ? getObservedAppState(appState)
    //   : appState;
    const nextAppStateSnapshot = appState;
    const didAppStateChange = this.detectChangedAppState(nextAppStateSnapshot);
    if (!didAppStateChange) {
      return this.appState;
    }
    return nextAppStateSnapshot;
  }
  private detectChangedAppState(nextObservedAppState: ObservedAppState) {
    return !isShallowEqual(this.appState, nextObservedAppState, {
      // selectedElementIds: isShallowEqual,
      // selectedGroupIds: isShallowEqual,
    });
  }
  private maybeCreateElementsSnapshot(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
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

  /**
   * Detect if there any changed elements.
   *
   * NOTE: we shouldn't just use `sceneVersionNonce` instead, as we need to call this before the scene updates.
   */
  private detectChangedElements(
    nextElements: Map<string, OrderedExcalidrawElement>,
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
        prev.id !== next.id ||
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
    nextElements: Map<string, OrderedExcalidrawElement>,
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
        // @see https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_clonedeep
        clonedElements.set(id, structuredClone(nextElement));
      }
    }
    return clonedElements;
  }
}

/**
 * @see https://github.com/excalidraw/excalidraw/blob/ab89d4c16f53bd1e06cb980c600f0952b7a3d7d3/packages/excalidraw/element/mutateElement.ts#L152
 */
export const newElementWith = <TElement extends SerializedNode>(
  element: TElement,
  updates: Partial<TElement>,
  /** pass `true` to always regenerate */
  force = false,
): TElement => {
  let didChange = false;
  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== 'undefined') {
      if (
        (element as any)[key] === value &&
        // if object, always update because its attrs could have changed
        (typeof value !== 'object' || value === null)
      ) {
        continue;
      }
      didChange = true;
    }
  }

  if (!didChange && !force) {
    return element;
  }

  return {
    ...element,
    ...updates,
    updated: getUpdatedTimestamp(),
    version: element.version + 1,
    versionNonce: randomInteger(),
  };
};
