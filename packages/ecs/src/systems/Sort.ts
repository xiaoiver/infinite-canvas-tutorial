import { System } from '@lastolivegames/becsy';
import {
  GlobalRenderOrder,
  Parent,
  Renderable,
  Visibility,
  ZIndex,
} from '../components';

/**
 * Sort entities by z-index under context.
 *
 * @see https://infinitecanvas.cc/guide/lesson-014#z-index
 */
export class Sort extends System {
  renderables = this.query(
    (q) => q.addedOrChanged.with(Renderable).trackWrites,
  );

  visibilities = this.query(
    (q) => q.addedChangedOrRemoved.with(Visibility).trackWrites,
  );

  zIndex = this.query((q) => q.addedChangedOrRemoved.with(ZIndex).trackWrites);

  constructor() {
    super();
    this.query((q) => q.with(GlobalRenderOrder).write);
    this.query((q) => q.current.with(Parent).read);
  }

  execute() {
    let i = 1;
    this.renderables.addedOrChanged.forEach((entity) => {
      if (!entity.has(GlobalRenderOrder)) {
        entity.add(GlobalRenderOrder);
      }

      Object.assign(entity.write(GlobalRenderOrder), {
        value: i++,
      });
    });

    // this.root.addedOrChanged.forEach((entity) => {
    //   console.log(entity);
    // });
  }
}
