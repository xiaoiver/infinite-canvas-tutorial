import { ConfigurableTrait, Entity } from 'koota';
import { Commands } from './Commands';
import { AddChild, Insert, RemoveChild } from './Command';

/**
 * A list of commands that will be run to modify an [entity](crate::entity).
 */
export class EntityCommands {
  constructor(public entity: Entity, public commands: Commands) {}

  /**
   * Returns the [`Entity`] id of the entity.
   *
   * @example
   * let entity_id = commands.spawnEmpty().id();
   */
  id() {
    return this.entity;
  }

  insert(...traits: ConfigurableTrait[]) {
    this.commands.add(new Insert(this.entity, traits));
    return this;
  }

  /**
   * Adds a single child.
   * If the children were previously children of another parent,
   * that parent's [`Children`] component will have those children removed from its list.
   * Removing all children from a parent causes its [`Children`] component to be removed from the entity.
   *
   * @see https://bevy-cheatbook.github.io/fundamentals/hierarchy.html#hierarchical-parentchild-entities
   */
  appendChild(child: EntityCommands) {
    const parent = this.id();
    if (child.id() === parent) {
      throw new Error('Cannot add entity as a child of itself.');
    }

    this.commands.add(new AddChild(parent, child.id()));
    return this;
  }

  removeChild(child: EntityCommands) {
    const parent = this.id();
    if (child.id() === parent) {
      throw new Error('Cannot add entity as a child of itself.');
    }

    this.commands.add(new RemoveChild(parent, child.id()));
    return this;
  }

  destroy() {}
}
