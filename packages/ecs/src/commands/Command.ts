import { Entity, System } from '@lastolivegames/becsy';
import { Resource } from '../Resource';

export interface Command {
  apply(system: System): void;
}

interface WithEntity<C extends EntityCommand = EntityCommand> {
  cmd: C;
  id: Entity;
}

/**
 * A [`Command`] which gets executed for a given [`Entity`].
 *
 * @example
 * class CountName implements EntityCommand {
 *   apply(id: Entity) {
 *   }
 * }
 *
 * commands.spawn_empty().add(CountName);
 */
export interface EntityCommand extends Command {
  with_entity(id: Entity): WithEntity;
}

/**
 * A [`Command`] that inserts a [`Resource`] into the world.
 */
export class InsertResource implements Command {
  constructor(public resource: Resource) {}

  apply() {}
}

export class RemoveResource implements Command {
  constructor(public resource: Resource) {}

  apply() {}
}
