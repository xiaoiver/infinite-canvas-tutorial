import { Entity, field, Type } from '@lastolivegames/becsy';

export enum SeletedStatus {
  IDLE = 'idle',
  MOVING = 'moving',
  MOVED = 'moved',
  RESIZING = 'resizing',
  RESIZED = 'resized',
  ROTATING = 'rotating',
  ROTATED = 'rotated',
}
export class Selected {
  @field.ref declare camera: Entity;

  @field({
    type: Type.staticString([
      SeletedStatus.IDLE,
      SeletedStatus.MOVING,
      SeletedStatus.MOVED,
      SeletedStatus.RESIZING,
      SeletedStatus.RESIZED,
      SeletedStatus.ROTATING,
      SeletedStatus.ROTATED,
    ]),
    default: SeletedStatus.IDLE,
  })
  declare status: SeletedStatus;
}
