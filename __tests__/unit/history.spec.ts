import {
  Circle,
  HistoryEntry,
  History,
  Snapshot,
  ElementsChange,
  AppStateChange,
  serializeNode,
  getDefaultAppState,
  AppState,
} from '../../packages/core/src';

describe('history', () => {
  it('empty', () => {
    const circle = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: '#F67676',
    });
    const serialized = serializeNode(circle);

    const appState = getDefaultAppState() as AppState;

    const history = new History();

    const corrupedEntry = HistoryEntry.create(
      AppStateChange.empty(),
      ElementsChange.empty(),
    );

    expect(history.undoStack.length).toBe(0);
    expect(history.redoStack.length).toBe(0);

    history.undoStack.push(corrupedEntry);

    history.undo(
      new Map([[serialized.uid, serialized]]),
      appState,
      Snapshot.empty(),
    );
    expect(history.undoStack.length).toBe(0);
    expect(history.redoStack.length).toBe(1);

    history.redo(
      new Map([[serialized.uid, serialized]]),
      appState,
      Snapshot.empty(),
    );
    expect(history.undoStack.length).toBe(1);
    expect(history.redoStack.length).toBe(0);
  });
});
