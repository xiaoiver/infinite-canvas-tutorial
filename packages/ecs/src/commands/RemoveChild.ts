import { Entity, System } from '@lastolivegames/becsy';
import { Command } from './Command';
import { Children, Parent } from '../components';

export class RemoveChild implements Command {
  constructor(public parent: Entity, public child: Entity) {}

  apply(system: System) {
    this.child.remove(Children);

    if (this.parent.read(Parent).children.length === 0) {
      this.parent.remove(Parent);
    }

    // TODO: emit REMOVE_CHILD event.
  }
}
