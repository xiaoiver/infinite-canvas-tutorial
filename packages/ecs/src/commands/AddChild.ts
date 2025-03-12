import { Entity, System } from '@lastolivegames/becsy';
import { Command } from './Command';
import { Children, Parent } from '../components';

export class AddChild implements Command {
  constructor(public parent: Entity, public child: Entity) {}

  apply(system: System) {
    if (!this.parent.has(Parent)) {
      this.parent.add(Parent);
    }
    // @see https://lastolivegames.github.io/becsy/guide/architecture/components.html#referencing-entities
    this.child.add(Children, {
      parent: this.parent,
    });

    // TODO: emit ADD_CHILD event.
  }
}
