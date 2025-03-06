import { ComponentType, Entity } from '@lastolivegames/becsy';
import { AddChild } from './AddChild';
import { Insert } from './Insert';
import { Commands } from './Commands';
import { Bundle } from '../components';

/**
 * A list of commands that will be run to modify an [entity](crate::entity).
 */
export class EntityCommands {
  constructor(public entity: Entity, public commands: Commands) {}

  /**
   * Returns the [`Entity`] id of the entity.
   *
   * @example
   * let entity_id = commands.spawn_empty().id();
   */
  id() {
    return this.entity;
  }

  /**
   * Adds a [`Bundle`] of components to the entity.
   * This will overwrite any previous value(s) of the same component type.
   *
   * @example
   * commands
   *   .entity(0)
   *   .insert([Defense, { x: 10 }], [Transform, { translation } ])
   *   .insert([Bundle, { transform }])
   */
  insert(...bundles: (ComponentType<any> | Bundle)[]) {
    this.commands.add(new Insert(this.entity, bundles));
    return this;
  }

  /**
   * Removes a [`Bundle`] of components from the entity.
   * @example
   * commands.entity(0).remove(Transform);
   */
  remove(...components: ComponentType<any>[]) {
    // this.commands.add(CommandsType.REMOVE, this.entity, null, ...components);
  }

  /**
   * Despawns the entity.
   */
  despawn() {
    // this.commands.add(CommandsType.DESPAWN, this.entity, null, null);
  }

  /**
   * Adds a single child.
   * If the children were previously children of another parent,
   * that parent's [`Children`] component will have those children removed from its list.
   * Removing all children from a parent causes its [`Children`] component to be removed from the entity.
   */
  addChild(child: Entity) {
    let parent = this.id();
    if (child === parent) {
      throw new Error('Cannot add entity as a child of itself.');
    }

    this.commands.add(new AddChild(parent, child));

    return this;
  }

  removeChildren(...children: Entity[]) {
    return this;
  }
}
