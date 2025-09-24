import { Entity, field } from '@lastolivegames/becsy';
export class SnapPoint {
  @field.ref declare camera: Entity;

  @field.object declare points: [number, number][];
}
