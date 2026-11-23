import { AppState, getDefaultAppState } from '../context';
import { randomInteger } from '../utils';
import { SerializedNode } from '../types/serialized-node';
import { getUpdatedTimestamp } from './ElementsChange';
import { observeAppState, ObservedAppState } from './ObservedAppState';
import { documentValueEqual } from '../document';

type OrderedExcalidrawElement = SerializedNode;

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
    version: (element.version || 0) + 1,
    versionNonce: randomInteger(),
  };
};

export class Snapshot {
  private constructor(
    public readonly elements: Map<string, SerializedNode>,
    public readonly appState: ObservedAppState,
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
    return new Snapshot(new Map(), observeAppState(getDefaultAppState()), {
      didElementsChange: false,
      didAppStateChange: false,
      isEmpty: true,
    });
  }

  isEmpty() {
    return !!this.meta.isEmpty;
  }
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
    if (!this.isEmpty() && !didElementsChange && !didAppStateChange) {
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
    const nextAppStateSnapshot = observeAppState(appState);
    const didAppStateChange = this.detectChangedAppState(nextAppStateSnapshot);
    if (!didAppStateChange) {
      return this.appState;
    }
    return nextAppStateSnapshot;
  }
  private detectChangedAppState(nextObservedAppState: ObservedAppState) {
    return !documentValueEqual(this.appState, nextObservedAppState);
  }
  private maybeCreateElementsSnapshot(
    elements: Map<string, OrderedExcalidrawElement> | undefined,
  ) {
    if (!elements || elements === this.elements) return this.elements;
    let cloned: Map<string, OrderedExcalidrawElement> | undefined;

    // Preserve deletion order, stable tombstones and the existing commit signal
    // for omitted IDs, even if a missing element was already deleted.
    for (const [id, previous] of this.elements) {
      if (!elements.get(id)) {
        cloned ??= new Map(this.elements);
        cloned.set(
          id,
          previous.isDeleted
            ? previous
            : newElementWith(previous, { isDeleted: true }),
        );
      }
    }
    // Compare each incoming node once. Copy the map lazily and keep unchanged
    // owned nodes, while deep-cloning only changes (including in-place edits).
    for (const [id, next] of elements) {
      const previous = this.elements.get(id);
      if (!previous || !documentValueEqual(previous, next)) {
        cloned ??= new Map(this.elements);
        cloned.set(id, structuredClone(next));
      }
    }
    return cloned ?? this.elements;
  }
}
