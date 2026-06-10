import { Entity, System } from '@lastolivegames/becsy';
import { generateNKeysBetween } from 'fractional-indexing';
import {
  Camera,
  Children,
  FractionalIndex,
  Parent,
  Transform,
  ZIndex,
} from '../components';
import { getDescendants, getSceneRoot } from './Transform';
import { safeAddComponent } from '../history';

export function sortByZIndex(a: Entity, b: Entity) {
  return a.read(ZIndex).value - b.read(ZIndex).value;
}

export class ComputeZIndex extends System {
  private readonly transforms = this.query((q) => q.added.with(Transform));

  private readonly zIndexes = this.query(
    (q) => q.added.and.changed.with(ZIndex).trackWrites,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(ZIndex, FractionalIndex)
          .write.and.using(Parent, Children, Camera).read,
    );
  }

  execute() {
    this.transforms.added.forEach((entity) => {
      safeAddComponent(entity, ZIndex);
    });

    // Collect the entities whose `ZIndex` was added or changed this frame,
    // grouped by the scene root (camera) they belong to.
    //
    // NOTE: we must reconcile all moved entities of an affected sub-tree in a
    // single consistent pass rather than recomputing each one individually.
    // When several entities change `ZIndex` in the same frame (e.g. two
    // `sendToBack` calls, a `group`, or undo/redo of a batched z-order change),
    // a moved entity's neighbour may still hold a stale `FractionalIndex` that
    // no longer matches the new z-order. Computing a key between two stale,
    // out-of-order neighbours throws (`generateKeyBetween(prev, next)` requires
    // prev < next) and corrupts the render order.
    const movedByCamera = new Map<Entity, Set<Entity>>();
    const collect = (entity: Entity) => {
      if (entity.has(Camera)) {
        return;
      }
      const camera = getSceneRoot(entity);
      let moved = movedByCamera.get(camera);
      if (!moved) {
        moved = new Set<Entity>();
        movedByCamera.set(camera, moved);
      }
      moved.add(entity);
    };
    this.zIndexes.added.forEach(collect);
    this.zIndexes.changed.forEach(collect);

    movedByCamera.forEach((moved, camera) => {
      const descendants = getDescendants(camera, sortByZIndex);
      this.reconcileFractionalIndices(descendants, moved);
    });
  }

  /**
   * Reassign `FractionalIndex` only for the `moved` entities, so that the
   * fractional indices are strictly increasing along the `ZIndex`-sorted order.
   *
   * Unmoved entities keep their keys: their relative z-order is unchanged, so
   * their keys are still monotonic among themselves. Each contiguous run of
   * moved entities is regenerated together with {@link generateNKeysBetween}
   * between its nearest unmoved (and therefore strictly ordered) neighbours,
   * which guarantees collision-free, in-order keys and never feeds an
   * out-of-order pair to the generator.
   */
  private reconcileFractionalIndices(
    descendants: Entity[],
    moved: Set<Entity>,
  ) {
    const n = descendants.length;

    let runStart = 0;
    while (runStart < n) {
      if (!moved.has(descendants[runStart])) {
        runStart++;
        continue;
      }

      let runEnd = runStart;
      while (runEnd < n && moved.has(descendants[runEnd])) {
        runEnd++;
      }

      const prev = runStart - 1 >= 0 ? descendants[runStart - 1] : null;
      const next = runEnd < n ? descendants[runEnd] : null;
      const lowerBound =
        (prev?.has(FractionalIndex) && prev.read(FractionalIndex).value) || null;
      const upperBound =
        (next?.has(FractionalIndex) && next.read(FractionalIndex).value) || null;

      const keys = generateNKeysBetween(lowerBound, upperBound, runEnd - runStart);
      for (let idx = runStart; idx < runEnd; idx++) {
        safeAddComponent(descendants[idx], FractionalIndex, {
          value: keys[idx - runStart],
        });
      }

      runStart = runEnd;
    }
  }
}
