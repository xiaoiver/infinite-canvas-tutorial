import { Entity, System } from '@lastolivegames/becsy';
import { generateKeyBetween } from 'fractional-indexing';
import {
  Children,
  FractionalIndex,
  Parent,
  Transform,
  ZIndex,
} from '../components';
import { getDescendants, getSceneRoot } from './Transform';

export function sortByZIndex(a: Entity, b: Entity) {
  return a.read(ZIndex).value - b.read(ZIndex).value;
}

export class ComputeZIndex extends System {
  private readonly transforms = this.query((q) => q.added.with(Transform));

  private readonly zIndexes = this.query(
    (q) => q.addedOrChanged.with(ZIndex).trackWrites,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q.using(ZIndex, FractionalIndex).write.and.using(Parent, Children).read,
    );
  }

  execute() {
    this.transforms.added.forEach((entity) => {
      if (!entity.has(ZIndex)) {
        entity.add(ZIndex);
      }
    });

    const cameraDescendantsMap = new Map<Entity, Entity[]>();

    this.zIndexes.addedOrChanged.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (!cameraDescendantsMap.has(camera)) {
        const descendants = getDescendants(camera, sortByZIndex);
        cameraDescendantsMap.set(camera, descendants);
      }

      const descendants = cameraDescendantsMap.get(camera);
      const index = descendants.indexOf(entity);
      const prev = descendants[index - 1] || null;
      const next = descendants[index + 1] || null;
      const prevFractionalIndex =
        (prev?.has(FractionalIndex) && prev.read(FractionalIndex)?.value) ||
        null;
      const nextFractionalIndex =
        (next?.has(FractionalIndex) && next.read(FractionalIndex)?.value) ||
        null;

      try {
        const key = generateKeyBetween(
          prevFractionalIndex,
          nextFractionalIndex,
        );

        if (!entity.has(FractionalIndex)) {
          entity.add(FractionalIndex);
        }
        entity.write(FractionalIndex).value = key;
      } catch (e) {
        console.log(e);
      }
    });
  }
}
