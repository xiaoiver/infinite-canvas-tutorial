/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/store.ts
 */

import { EventEmitter } from 'eventemitter3';
import { AppState } from '../context';
import { AppStateChange } from './AppStateChange';
import { ElementsChange } from './ElementsChange';
import { Snapshot } from './Snapshot';
import { API } from '../API';
import { SerializedNode } from '../utils';

export const StoreIncrementEvent = 'storeIncrement';

export type ValueOf<T> = T[keyof T];

export const CaptureUpdateAction = {
  /**
   * Immediately undoable.
   *
   * Use for updates which should be captured.
   * Should be used for most of the local updates.
   *
   * These updates will _immediately_ make it to the local undo / redo stacks.
   */
  IMMEDIATELY: 'IMMEDIATELY',
  /**
   * Never undoable.
   *
   * Use for updates which should never be recorded, such as remote updates
   * or scene initialization.
   *
   * These updates will _never_ make it to the local undo / redo stacks.
   */
  NEVER: 'NEVER',
  /**
   * Eventually undoable.
   *
   * Use for updates which should not be captured immediately - likely
   * exceptions which are part of some async multi-step process. Otherwise, all
   * such updates would end up being captured with the next
   * `CaptureUpdateAction.IMMEDIATELY` - triggered either by the next `updateScene`
   * or internally by the editor.
   *
   * These updates will _eventually_ make it to the local undo / redo stacks.
   */
  EVENTUALLY: 'EVENTUALLY',
} as const;

export type CaptureUpdateActionType = ValueOf<typeof CaptureUpdateAction>;

export class Store {
  #snapshot = Snapshot.empty();
  #scheduledActions: Set<CaptureUpdateActionType> = new Set();

  onStoreIncrementEmitter = new EventEmitter();

  constructor(private readonly api: API) {}

  get snapshot() {
    return this.#snapshot;
  }

  set snapshot(snapshot: Snapshot) {
    this.#snapshot = snapshot;
  }

  private scheduleAction(action: CaptureUpdateActionType) {
    this.#scheduledActions.add(action);
  }

  shouldCaptureIncrement() {
    this.scheduleAction(CaptureUpdateAction.IMMEDIATELY);
  }

  shouldUpdateSnapshot() {
    this.scheduleAction(CaptureUpdateAction.NEVER);
  }

  commit(
    elements: Map<string, SerializedNode> | undefined,
    appState: AppState | undefined,
  ) {
    try {
      // Capture has precedence since it also performs update
      if (this.#scheduledActions.has(CaptureUpdateAction.IMMEDIATELY)) {
        this.captureIncrement(elements, appState);
      } else if (this.#scheduledActions.has(CaptureUpdateAction.NEVER)) {
        this.updateSnapshot(elements, appState);
      }
    } finally {
      // Defensively reset all scheduled actions, potentially cleans up other runtime garbage
      this.#scheduledActions = new Set();
    }
  }

  captureIncrement(
    elements: Map<string, SerializedNode> | undefined,
    appState: AppState | undefined,
  ) {
    const prevSnapshot = this.snapshot;
    const nextSnapshot = this.snapshot.maybeClone(elements, appState);

    // Optimisation, don't continue if nothing has changed
    if (prevSnapshot !== nextSnapshot) {
      // Calculate and record the changes based on the previous and next snapshot
      const elementsChange = nextSnapshot.meta.didElementsChange
        ? ElementsChange.calculate(
            prevSnapshot.elements,
            nextSnapshot.elements,
            this.api,
          )
        : ElementsChange.empty();

      const appStateChange = nextSnapshot.meta.didAppStateChange
        ? AppStateChange.calculate(prevSnapshot.appState, nextSnapshot.appState)
        : AppStateChange.empty();

      if (!elementsChange.isEmpty() || !appStateChange.isEmpty()) {
        // Notify listeners with the increment
        this.onStoreIncrementEmitter.emit(StoreIncrementEvent, {
          elementsChange,
          appStateChange,
        });
      }

      // Update snapshot
      this.snapshot = nextSnapshot;
    }
  }

  updateSnapshot(
    elements: Map<string, SerializedNode> | undefined,
    appState: AppState | undefined,
  ) {
    const nextSnapshot = this.snapshot.maybeClone(elements, appState);

    if (this.snapshot !== nextSnapshot) {
      // Update snapshot
      this.snapshot = nextSnapshot;
    }
  }
}
