import { Entity, field } from '@lastolivegames/becsy';
export class Selected {
  @field.ref declare camera: Entity;
}
