/**
 * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts
 */

import { AppState } from '../Canvas';
import { AppStateChange } from './app-state-change';
import { ElementsChange, SceneElementsMap } from './elements-change';
import { Snapshot } from './store';

export class HistoryEntry {
  private constructor(
    public readonly appStateChange: AppStateChange,
    public readonly elementsChange: ElementsChange,
  ) {}

  static create(
    appStateChange: AppStateChange,
    elementsChange: ElementsChange,
  ) {
    return new HistoryEntry(appStateChange, elementsChange);
  }

  inverse(): HistoryEntry {
    return new HistoryEntry(
      this.appStateChange.inverse(),
      this.elementsChange.inverse(),
    );
  }

  applyTo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] =
      this.elementsChange.applyTo(elements, snapshot.elements);

    const [nextAppState, appStateContainsVisibleChange] =
      this.appStateChange.applyTo(appState, nextElements);

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /**
   * Apply latest (remote) changes to the history entry, creates new instance of `HistoryEntry`.
   */
  applyLatestChanges(elements: SceneElementsMap): HistoryEntry {
    const updatedElementsChange =
      this.elementsChange.applyLatestChanges(elements);

    return HistoryEntry.create(this.appStateChange, updatedElementsChange);
  }

  isEmpty(): boolean {
    return this.appStateChange.isEmpty() && this.elementsChange.isEmpty();
  }
}

type HistoryStack = HistoryEntry[];

export class History {
  #undoStack: HistoryStack = [];
  #redoStack: HistoryStack = [];

  private static pop(stack: HistoryStack): HistoryEntry | null {
    if (!stack.length) {
      return null;
    }

    const entry = stack.pop();

    if (entry !== undefined) {
      return entry;
    }

    return null;
  }

  private static push(
    stack: HistoryStack,
    entry: HistoryEntry,
    prevElements: SceneElementsMap,
  ) {
    const updatedEntry = entry.inverse().applyLatestChanges(prevElements);
    return stack.push(updatedEntry);
  }

  get undoStack() {
    return this.#undoStack;
  }

  get redoStack() {
    return this.#redoStack;
  }

  clear() {
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
  }

  undo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ) {
    return this.perform(
      elements,
      appState,
      snapshot,
      () => History.pop(this.#undoStack),
      (entry: HistoryEntry) => History.push(this.#redoStack, entry, elements),
    );
  }

  public redo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
  ) {
    return this.perform(
      elements,
      appState,
      snapshot,
      () => History.pop(this.#redoStack),
      (entry: HistoryEntry) => History.push(this.#undoStack, entry, elements),
    );
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: Readonly<Snapshot>,
    pop: () => HistoryEntry | null,
    push: (entry: HistoryEntry) => void,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyEntry = pop();

      if (historyEntry === null) {
        return;
      }

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyEntry) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            historyEntry.applyTo(nextElements, nextAppState, snapshot);
        } finally {
          // make sure to always push / pop, even if the increment is corrupted
          push(historyEntry);
        }

        if (containsVisibleChange) {
          break;
        }

        historyEntry = pop();
      }

      return [nextElements, nextAppState];
    } finally {
      // trigger the history change event before returning completely
      // also trigger it just once, no need doing so on each entry
      // this.onHistoryChangedEmitter.trigger(
      //   new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      // );
    }
  }
}
