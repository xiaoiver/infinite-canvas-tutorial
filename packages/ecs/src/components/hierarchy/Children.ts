import { Entity, field } from '@lastolivegames/becsy';

/**
 * @see bevy_hierarchy Children
 */
export class Children {
  @field.ref declare parent: Entity;
}
