import { Entity, System } from '@lastolivegames/becsy';
import { generateKeyBetween } from 'fractional-indexing';
import {
  Camera,
  Children,
  FractionalIndex,
  Parent,
  ZIndex,
} from '../components';
import { getDescendants, getSceneRoot } from './Transform';

export function sortByZIndex(a: Entity, b: Entity) {
  if (!a.has(ZIndex) && !b.has(ZIndex)) {
    return (
      a.read(Children).parent.read(Parent).children.indexOf(a) -
      b.read(Children).parent.read(Parent).children.indexOf(b)
    );
  }

  if (!a.has(ZIndex) && b.has(ZIndex)) {
    return -1;
  }
  if (a.has(ZIndex) && !b.has(ZIndex)) {
    return 1;
  }
  return a.read(ZIndex).value - b.read(ZIndex).value;
}

export class ComputeZIndex extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

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
    this.cameras.current.forEach((entity) => {
      getDescendants(entity, sortByZIndex).forEach((child) => {
        if (!child.has(ZIndex)) {
          child.add(ZIndex);
        }
      });
    });

    this.zIndexes.addedOrChanged.forEach((entity) => {
      const descendants = getDescendants(getSceneRoot(entity));
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

      if (!entity.has(FractionalIndex)) {
        entity.add(FractionalIndex);
      }
      entity.write(FractionalIndex).value = key;
    });
  }
}
