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
import { newElementWith } from '../../packages/core/src/utils/serialize';

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

it.each([undefined, 0, 7, NaN])(
  'initializes a copied document version from %s',
  (version) => {
    const original = {
      uid: 8,
      type: 'rect' as const,
      version,
      isDeleted: false,
    };
    const next = newElementWith(original, { isDeleted: true });
    expect(next.version).toBe((version || 0) + 1);
    expect(JSON.parse(JSON.stringify(next)).version).toBe(next.version);
    expect(original.isDeleted).toBe(false);
    expect(Object.is(original.version, version)).toBe(true);
    expect(newElementWith(original, { isDeleted: false })).toBe(original);
    expect(newElementWith(original, {}, true).version).toBe((version || 0) + 1);
  },
);
