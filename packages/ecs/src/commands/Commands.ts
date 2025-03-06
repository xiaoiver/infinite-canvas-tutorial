import { Entity, ComponentType, System } from '@lastolivegames/becsy';
import { Resource } from '../Resource';
import { EntityCommands } from './EntityCommands';
import { Command, InsertResource, RemoveResource } from './Command';
import { Bundle } from '../components';

/**
 * A [`Command`] queue to perform impactful changes to the [`World`].
 *
 * Use Commands to spawn/despawn entities, add/remove components on existing entities, manage resources.
 * These actions do not take effect immediately; they are queued to be performed later when it is safe to do so.
 * See: stages.
 * @see https://bevy-cheatbook.github.io/programming/commands.html
 */
export class Commands {
  private queue: Command[] = [];

  constructor(private system: System) {}

  execute() {
    this.queue.forEach((command) => {
      command.apply(this.system);
    });
    this.queue = [];
  }

  entity(entity: Entity) {
    return new EntityCommands(entity, this);
  }

  /**
   * Pushes a generic [`Command`] to the command queue.
   * @see https://github.com/bevyengine/bevy/blob/main/crates/bevy_ecs/src/system/commands/mod.rs#L586
   */
  add(command: Command) {
    this.queue.push(command);
    // } else if (type === CommandsType.REMOVE) {
    //   components.forEach((component) => {
    //     entity.remove(component);
    //   });
    // } else if (type === CommandsType.DESPAWN) {
    //   entity.removeAll();
    // } else if (type === CommandsType.ADD_CHILD) {
    // }
  }

  /**
   * Pushes a [`Command`] to the queue for creating a new empty [`Entity`],
   * and returns its corresponding [`EntityCommands`].
   *
   * @example
   * // Create a new empty entity and retrieve its id.
   * let empty_entity = commands.spawn_empty().id();
   *
   * // Create another empty entity, then add some component to it
   * commands.spawn_empty()
   *   // adds a new component bundle to the entity
   *   .insert([Strength, { value: 1 }], [Agility, { value: 1 }])
   *   // adds a single component to the entity
   *   .insert([Label, { value: "hello world" });
   */
  spawnEmpty() {
    return new EntityCommands(this.system.createEntity(), this);
  }

  /**
   * Pushes a [`Command`] to the queue for creating a new [`Entity`] if the given one does not exists,
   * and returns its corresponding [`EntityCommands`].
   *
   * Spawning a specific `entity` value is rarely the right choice. Most apps should favor
   * [`Commands::spawn`]. This method should generally only be used for sharing entities across
   * apps, and only when they have a scheme worked out to share an ID space (which doesn't happen by default).
   */
  getOrSpawn(entity: Entity) {
    return new EntityCommands(entity, this);
  }

  /**
   * Pushes a [`Command`] to the queue for creating a new entity with the given [`Bundle`]'s components,
   * and returns its corresponding [`EntityCommands`].
   *
   * @example
   * // Create a new entity with a single component.
   * commands.spawn([Transform, {}]);
   *
   * // Create a new entity with a component bundle.
   * commands.spawn([Transform, {}]);
   *
   * commands
   *   .spawn([Defense, { x: 10 }])
   *   .insert([Defense, { x: 10 }]);
   */
  spawn(...bundles: (ComponentType<any> | Bundle)[]) {
    const e = this.spawnEmpty();
    e.insert(...bundles);
    return e;
  }

  /**
   * Pushes a [`Command`] to the queue for inserting a [`Resource`] in the [`World`] with a specific value.
   *
   * If there is only one global instance (singleton) of something, and it is standalone (not associated with other data), create a Resource.
   * For example, you could create a resource to store your game's graphics settings, or the data for the currently active game mode or session.
   * This is a simple way of storing data, when you know you don't need the flexibility of Entities/Components.
   * @see https://bevy-cheatbook.github.io/programming/intro-data.html#resources
   *
   * @example
   * commands.insert_resource(new Scoreboard(0, 0));
   */
  insertResource(resource: Resource) {
    this.queue.push(new InsertResource(resource));
  }

  /**
   * Pushes a [`Command`] to the queue for removing a [`Resource`] from the [`World`].
   *
   * @example
   * commands.remove_resource(scoreboard);
   */
  removeResource(resource: Resource) {
    this.queue.push(new RemoveResource(resource));
  }
}
