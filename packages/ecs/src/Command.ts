import { ConfigurableTrait, Entity, relation } from 'koota';

export const ChildOf = relation();

export interface Command {
  apply(): void;
}

export class AddChild implements Command {
  constructor(public parent: Entity, public child: Entity) {}

  apply() {
    this.child.add(ChildOf(this.parent));

    // TODO: emit ADD_CHILD event.
  }
}

export class RemoveChild implements Command {
  constructor(public parent: Entity, public child: Entity) {}

  apply() {
    this.child.remove(ChildOf(this.parent));

    // TODO: emit REMOVE_CHILD event.
  }
}

/**
 * A [`Command`] that adds the components in a [`Bundle`] to an entity.
 */
export class Insert implements Command {
  constructor(public id: Entity, public traits: ConfigurableTrait[]) {}

  apply() {
    this.id.add(...this.traits);
  }
}
