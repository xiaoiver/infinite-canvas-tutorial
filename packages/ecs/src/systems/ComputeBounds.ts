import { System } from '@lastolivegames/becsy';
import { ComputedBounds, Renderable } from '../components';

export class ComputeBounds extends System {
  renderables = this.query(
    (q) => q.addedOrChanged.with(Renderable).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedBounds).write);
  }

  execute() {
    this.renderables.addedOrChanged.forEach((entity) => {});
  }
}
