import {
  type SerializedNode,
  type RectSerializedNode,
  getDefaultAppState,
} from '../../packages/ecs/src';
import { AppStateChange } from '../../packages/ecs/src/history/AppStateChange';
import { Delta } from '../../packages/ecs/src/history/Delta';
import { ElementsChange } from '../../packages/ecs/src/history/ElementsChange';
import {
  Snapshot,
  newElementWith,
} from '../../packages/ecs/src/history/Snapshot';

const rect = (patch: Partial<SerializedNode> = {}): RectSerializedNode =>
  ({
    id: 'a',
    type: 'rect',
    x: 10,
    y: 20,
    width: 40,
    height: 30,
    zIndex: 0,
    version: 1,
    versionNonce: 1,
    ...patch,
  } as RectSerializedNode);
const map = (...nodes: SerializedNode[]) =>
  new Map(nodes.map((node) => [node.id, node]));

describe('document deltas', () => {
  it.each([
    { fills: [{ type: 'solid', value: 'red' }] },
    { strokes: [{ type: 'solid', value: 'blue', opacity: 0.5 }] },
    { filters: [{ type: 'blur', params: { radius: 3 } }] },
    {
      points: [
        [0, 0],
        [10, 20],
      ],
    },
  ])('excludes equal nested values from a width-only delta: %j', (nested) => {
    const before = { width: 40, ...nested };
    const after = { ...structuredClone(before), width: 70 };
    const delta = Delta.calculate(before, after);
    expect(delta.deleted).toEqual({ width: 40 });
    expect(delta.inserted).toEqual({ width: 70 });
    expect(Delta.isLeftDifferent(before, structuredClone(before))).toBe(false);
    expect(Delta.isRightDifferent(before, structuredClone(before))).toBe(false);
  });

  it('detects nested edits, array reordering, removed properties and zero values', () => {
    const before = {
      fills: [{ value: 'red' }],
      order: ['a', 'b'],
      opacity: 1,
      name: 'old',
    };
    const after = { fills: [{ value: 'blue' }], order: ['b', 'a'], opacity: 0 };
    const delta = Delta.calculate(before, after);
    expect(delta.deleted).toEqual(before);
    expect(delta.inserted).toEqual({ ...after, name: undefined });
    expect(Delta.isLeftDifferent({ name: 'old' }, {})).toBe(true);
    expect(Delta.isRightDifferent({ name: 'old' }, {})).toBe(false);
    expect(Delta.isRightDifferent({}, { name: 'new' })).toBe(true);
    expect(Delta.isEmpty(Delta.calculate(after, after))).toBe(true);
  });

  it('ignores metadata-only changes and identical map inputs', () => {
    const before = map(rect());
    expect(ElementsChange.calculate(before, before, undefined).isEmpty()).toBe(
      true,
    );
    expect(
      ElementsChange.calculate(
        before,
        map(rect({ version: 2, versionNonce: 3, updated: 123 })),
        undefined,
      ).isEmpty(),
    ).toBe(true);
  });

  it('removes a newly introduced attribute on undo without mutating the live document', () => {
    const before = map(rect());
    const after = map(rect({ name: 'local' }));
    const current = map(rect({ name: 'local', width: 90 }));
    const original = structuredClone(current);
    const change = ElementsChange.calculate(before, after, undefined);
    const [undone, visible] = change.inverse().applyTo(current, after);
    expect(visible).toBe(true);
    expect(undone.get('a')).not.toHaveProperty('name');
    expect(undone.get('a').width).toBe(90);
    expect([...current]).toEqual([...original]);
    const [redone] = change.applyTo(undone, after);
    expect(redone.get('a')).toMatchObject({ name: 'local', width: 90 });
  });

  it.each([false, true])(
    'restores deletion from the snapshot (explicit tombstone: %s)',
    (explicit) => {
      const before = map(rect({ isDeleted: false }));
      const after = explicit
        ? map(rect({ isDeleted: true }))
        : new Map<string, SerializedNode>();
      const change = ElementsChange.calculate(before, after, undefined);
      const [removed, removalVisible] = change.applyTo(before, before);
      expect(removalVisible).toBe(true);
      expect(removed.get('a').isDeleted).toBe(true);
      const [restored, restorationVisible] = change
        .inverse()
        .applyTo(new Map(), removed);
      expect(restorationVisible).toBe(true);
      expect(restored.get('a')).toMatchObject({
        id: 'a',
        width: 40,
        isDeleted: false,
      });
      expect(before.get('a').isDeleted).toBe(false);
      expect(removed.get('a').isDeleted).toBe(true);
    },
  );

  it('does not resurrect a tombstone for an ordinary field edit', () => {
    const before = map(rect());
    const after = map(rect({ width: 70 }));
    const change = ElementsChange.calculate(before, after, undefined);
    const [result, visible] = change
      .inverse()
      .applyTo(new Map(), map(rect({ width: 70, isDeleted: true })));
    expect(visible).toBe(false);
    expect(result.get('a')).toMatchObject({ width: 40, isDeleted: true });
    const [missing, missingVisible] = change.applyTo(new Map(), new Map());
    expect(missing.size).toBe(0);
    expect(missingVisible).toBe(false);
  });

  it('replays the latest value for changed keys while preserving unrelated remote edits', () => {
    const change = ElementsChange.calculate(
      map(rect()),
      map(rect({ width: 70 })),
      undefined,
    );
    const latest = change.applyLatestChanges(
      map(rect({ width: 90, name: 'remote' })),
    );
    const [result] = latest.applyTo(
      map(rect({ name: 'newer remote' })),
      new Map(),
    );
    expect(result.get('a')).toMatchObject({ width: 90, name: 'newer remote' });
    const [missingLatest] = change
      .applyLatestChanges(new Map())
      .applyTo(map(rect()), new Map());
    expect(missingLatest.get('a').width).toBe(70);
  });

  it('does not restore stale design variables when undoing only a filter', () => {
    const before = {
      ...getDefaultAppState(),
      variables: { color: { type: 'color' as const, value: 'red' } },
    };
    const after = { ...structuredClone(before), filter: 'blur(2px)' };
    const remote = {
      ...after,
      variables: { color: { type: 'color' as const, value: 'blue' } },
    };
    const change = AppStateChange.calculate(before, after, undefined);
    const [result, visible] = change.inverse().applyTo(remote, new Map());
    expect(visible).toBe(true);
    expect(result.filter).toBe(before.filter);
    expect(result.variables).toEqual(remote.variables);
    expect(
      AppStateChange.calculate(
        before,
        structuredClone(before),
        undefined,
      ).isEmpty(),
    ).toBe(true);
  });
});

describe('document snapshots', () => {
  it('reuses unchanged nodes, but owns nested values and detects edits without a version bump', () => {
    const live = rect({ fills: [{ type: 'solid', value: 'red' }] });
    const baseline = Snapshot.empty().maybeClone(
      map(live, rect({ id: 'b' })),
      getDefaultAppState(),
    );
    const original = baseline.elements.get('a');
    (live.fills[0] as { value: string }).value = 'blue';
    const changed = baseline.maybeClone(
      map(live, rect({ id: 'b' })),
      undefined,
    );
    expect((original as RectSerializedNode).fills).toEqual([
      { type: 'solid', value: 'red' },
    ]);
    expect((changed.elements.get('a') as RectSerializedNode).fills).toEqual([
      { type: 'solid', value: 'blue' },
    ]);
    expect(changed.elements.get('b')).toBe(baseline.elements.get('b'));
    expect(changed.appState).toBe(baseline.appState);
    expect(changed.meta).toMatchObject({
      didElementsChange: true,
      didAppStateChange: false,
    });
    expect(changed.maybeClone(changed.elements, undefined)).toBe(changed);
    expect(
      changed.maybeClone(structuredClone(changed.elements), undefined),
    ).toBe(changed);
  });

  it('retains missing nodes as stable tombstones and permits resurrection', () => {
    const baseline = Snapshot.empty().maybeClone(
      map(rect({ isDeleted: false })),
      undefined,
    );
    const deleted = baseline.maybeClone(new Map(), undefined);
    const tombstone = deleted.elements.get('a');
    expect(tombstone).toMatchObject({ isDeleted: true, version: 2 });
    expect(baseline.elements.get('a').isDeleted).toBe(false);
    const stillDeleted = deleted.maybeClone(new Map(), undefined);
    expect(stillDeleted.elements.get('a')).toBe(tombstone);
    const revived = stillDeleted.maybeClone(
      map(rect({ isDeleted: false, name: 'restored' })),
      undefined,
    );
    expect(revived.elements.get('a')).toMatchObject({
      name: 'restored',
      isDeleted: false,
    });
  });

  it('owns selected ids and nested variables without recopying the document', () => {
    const baseline = Snapshot.empty().maybeClone(
      map(rect()),
      getDefaultAppState(),
    );
    const state = {
      ...getDefaultAppState(),
      layersSelected: ['a'],
      variables: { color: { type: 'color' as const, value: 'red' } },
    };
    const changed = baseline.maybeClone(undefined, state);
    state.layersSelected.push('b');
    state.variables.color.value = 'blue';
    expect(changed.elements).toBe(baseline.elements);
    expect(changed.appState.layersSelected).toEqual(['a']);
    expect(changed.appState.variables.color.value).toBe('red');
    expect(changed.meta).toMatchObject({
      didElementsChange: false,
      didAppStateChange: true,
    });
  });

  it('only advances element metadata for real updates or forced removal', () => {
    const original = rect();
    expect(newElementWith(original, { width: 40, name: undefined })).toBe(
      original,
    );
    const updated = newElementWith(original, { width: 0 });
    expect(updated).toMatchObject({ width: 0, version: 2 });
    expect(original).toMatchObject({ width: 40, version: 1 });
    const forced = newElementWith(original, {}, true);
    expect(forced).not.toBe(original);
    expect(forced.version).toBe(2);
  });
});
