import { Entity, System } from '@lastolivegames/becsy';
import { generateKeyBetween } from 'fractional-indexing';
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

    const camerasToSort = new Set<Entity>();
    this.zIndexes.added.forEach((entity) => {
      if (entity.has(Camera)) {
        return;
      }

      const camera = getSceneRoot(entity);
      camerasToSort.add(camera);
    });
    if (camerasToSort.size > 0) {
      camerasToSort.forEach((camera) => {
        const descendants = getDescendants(camera, sortByZIndex);

        descendants.forEach((entity, index) => {
          const prev = descendants[index - 1] || null;
          const prevFractionalIndex =
            (prev?.has(FractionalIndex) && prev.read(FractionalIndex)?.value) ||
            null;
          const key = generateKeyBetween(prevFractionalIndex, null);
          safeAddComponent(entity, FractionalIndex, { value: key });
        });
      });
    }

    this.zIndexes.changed.forEach((entity) => {
      const camera = getSceneRoot(entity);
      const descendants = getDescendants(camera, sortByZIndex);

      const index = descendants.indexOf(entity);
      const prev = descendants[index - 1] || null;
      const next = descendants[index + 1] || null;
      const prevFractionalIndex =
        (prev?.has(FractionalIndex) && prev.read(FractionalIndex)?.value) ||
        null;
      const nextFractionalIndex =
        (next?.has(FractionalIndex) && next.read(FractionalIndex)?.value) ||
        null;

      const key = generateKeyBetween(prevFractionalIndex, nextFractionalIndex);
      safeAddComponent(entity, FractionalIndex, { value: key });
    });
  }
}
