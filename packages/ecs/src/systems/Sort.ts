import { System } from '@lastolivegames/becsy';
import { GlobalRenderOrder, Parent, Renderable, ZIndex } from '../components';

/**
 * Sort entities by z-index under context.
 *
 * @see https://infinitecanvas.cc/guide/lesson-014#z-index
 */
export class Sort extends System {
  // orphans = this.query(
  //   (q) =>
  //     q.addedChangedOrRemoved.with(Renderable).without(Parent, Children)
  //       .trackWrites,
  // );

  // root = this.query(
  //   (q) =>
  //     q.addedChangedOrRemoved
  //       .with(Renderable, Parent)
  //       .without(Children)
  //       .trackWrites.using(GlobalRenderOrder).write,
  // );

  renderables = this.query(
    (q) => q.addedChangedOrRemoved.with(Renderable).trackWrites,
  );

  zIndex = this.query((q) => q.addedChangedOrRemoved.with(ZIndex).trackWrites);

  constructor() {
    super();
    this.query((q) => q.with(GlobalRenderOrder).write);
    this.query((q) => q.current.with(Parent).read);
  }

  execute() {
    let i = 1;
    this.renderables.addedChangedOrRemoved.forEach((entity) => {
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
