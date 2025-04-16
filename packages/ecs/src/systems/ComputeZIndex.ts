import { Entity, System } from '@lastolivegames/becsy';
import { generateKeyBetween } from 'fractional-indexing';
import { Children, Parent, ZIndex } from '../components';

export class ComputeZIndex extends System {
  // parents = this.query((q) => q.addedChangedOrRemoved.with(Parent).trackWrites);

  // children = this.query(
  //   (q) => q.addedChangedOrRemoved.with(Children).trackWrites,
  // );

  constructor() {
    super();
    this.query((q) => q.using(ZIndex).write);
  }

  private generateKey(entity: Entity) {
    const parent = entity.has(Children) ? entity.read(Children).parent : null;

    if (parent) {
      const { children } = parent.read(Parent);
    }

    // return generateKeyBetween(parent, children);
  }

  execute() {
    // this.parents.addedChangedOrRemoved.forEach((entity) => {
    //   if (!entity.has(ZIndex)) {
    //     entity.add(ZIndex);
    //     // console.log('zindex', entity.__id);
    //   }
    // });
    // this.children.addedChangedOrRemoved.forEach((entity) => {
    //   if (!entity.has(ZIndex)) {
    //     entity.add(ZIndex);
    //     // console.log('zindex', entity.__id);
    //   }
    // });
  }
}
