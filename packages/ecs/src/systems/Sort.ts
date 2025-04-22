import { Entity, System } from '@lastolivegames/becsy';
import { FractionalIndex, GlobalRenderOrder, Renderable } from '../components';

export function sortByFractionalIndex(a: Entity, b: Entity) {
  if (a.has(FractionalIndex) && b.has(FractionalIndex)) {
    const aFractionalIndex = a.read(FractionalIndex).value;
    const bFractionalIndex = b.read(FractionalIndex).value;

    // Can't use localeCompare here.
    // @see https://github.com/rocicorp/fractional-indexing/issues/20
    if (aFractionalIndex < bFractionalIndex) return -1;
    if (aFractionalIndex > bFractionalIndex) return 1;
    return 0;
  }

  return 0;
}

/**
 * Sort entities by z-index under context.
 *
 * @see https://infinitecanvas.cc/guide/lesson-014#z-index
 */
export class Sort extends System {
  private renderables = this.query(
    (q) => q.current.with(Renderable).with(FractionalIndex).read,
  );

  private fractionalIndexes = this.query(
    (q) => q.addedChangedOrRemoved.with(FractionalIndex).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.with(GlobalRenderOrder).write);
  }

  execute() {
    if (this.fractionalIndexes.addedChangedOrRemoved.length > 0) {
      let i = 1;
      [...this.renderables.current]
        // Can't use toSorted here for compatibility with older browsers.
        // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted
        .sort((a, b) => {
          if (a.has(FractionalIndex) && b.has(FractionalIndex)) {
            const aFractionalIndex = a.read(FractionalIndex).value;
            const bFractionalIndex = b.read(FractionalIndex).value;

            // Can't use localeCompare here.
            // @see https://github.com/rocicorp/fractional-indexing/issues/20
            if (aFractionalIndex < bFractionalIndex) return -1;
            if (aFractionalIndex > bFractionalIndex) return 1;
            return 0;
          }
        })
        .forEach((entity) => {
          if (!entity.has(GlobalRenderOrder)) {
            entity.add(GlobalRenderOrder);
          }

          Object.assign(entity.write(GlobalRenderOrder), {
            value: i++,
          });
        });
    }
  }
}
