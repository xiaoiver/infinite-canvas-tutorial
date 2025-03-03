import { ConfigurableTrait, Entity, World } from 'koota';
import { EntityCommands } from './EntityCommands';
import { Command } from './Command';

/**
 * @see https://bevy-cheatbook.github.io/programming/commands.html
 */
export class Commands {
  #world: World;

  #queue: Command[] = [];

  constructor(world: World) {
    this.#world = world;
  }

  get world() {
    return this.#world;
  }

  /**
   * Pushes a generic [`Command`] to the command queue.
   * @see https://github.com/bevyengine/bevy/blob/main/crates/bevy_ecs/src/system/commands/mod.rs#L586
   */
  add(command: Command) {
    this.#queue.push(command);
  }

  execute() {
    this.#queue.forEach((command) => {
      command.apply();
    });
    this.#queue = [];
  }

  entity(entity: Entity) {
    return new EntityCommands(entity, this);
  }

  /**
   * Pushes a [`Command`] to the queue for creating a new empty [`Entity`],
   * and returns its corresponding [`EntityCommands`].
   *
   * @example
   * // Create a new empty entity and retrieve its id.
   * let empty_entity = commands.spawnEmpty().id();
   *
   * // Create another empty entity, then add some component to it
   * commands.spawnEmpty()
   *   // adds a new component bundle to the entity
   *   .insert(Strength({ value: 1 }), Agility({ value: 1 }))
   *   // adds a single component to the entity
   *   .insert(Label({ value: "hello world" }));
   */
  spawnEmpty() {
    return new EntityCommands(this.#world.spawn(), this);
  }

  spawn(...traits: ConfigurableTrait[]) {
    const e = this.spawnEmpty();
    e.insert(...traits);
    return e;
  }
}
