/**
 * History is a class that manages the undo and redo stacks.
 * @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#history
 */

import { AppState } from '../context';
import { AppStateChange } from './AppStateChange';
import { ElementsChange, SceneElementsMap } from './ElementsChange';
import { Snapshot } from './Snapshot';

type HistoryStack = HistoryEntry[];

export class History {
  // public readonly onHistoryChangedEmitter = new Emitter<
  //   [HistoryChangedEvent]
  // >();

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

  get isUndoStackEmpty() {
    return this.#undoStack.length === 0;
  }

  get isRedoStackEmpty() {
    return this.#redoStack.length === 0;
  }

  clear() {
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
  }

  /**
   * Record a local change which will go into the history
   */
  record(elementsChange: ElementsChange, appStateChange: AppStateChange) {
    const entry = HistoryEntry.create(appStateChange, elementsChange);

    if (!entry.isEmpty()) {
      // we have the latest changes, no need to `applyLatest`, which is done within `History.push`
      this.#undoStack.push(entry.inverse());

      console.log(this.#undoStack);

      if (!entry.elementsChange.isEmpty()) {
        // don't reset redo stack on local appState changes,
        // as a simple click (unselect) could lead to losing all the redo entries
        // only reset on non empty elements changes!
        this.#redoStack.length = 0;
      }

      // this.onHistoryChangedEmitter.trigger(
      //   new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      // );
    }
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

  redo(
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
