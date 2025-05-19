import { Entity, field } from '@lastolivegames/becsy';

/**
 * Highlight the object when hovering.
 */
export class Highlighted {
  @field.ref declare camera: Entity;
}
