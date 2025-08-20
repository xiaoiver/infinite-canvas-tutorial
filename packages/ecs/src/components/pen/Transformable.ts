import { Entity, field, Type } from '@lastolivegames/becsy';
import { Selected } from './Selected';
import { Highlighted } from './Highlighted';

export enum TransformableStatus {
  IDLE = 'idle',
  MOVING = 'moving',
  MOVED = 'moved',
  RESIZING = 'resizing',
  RESIZED = 'resized',
  ROTATING = 'rotating',
  ROTATED = 'rotated',
}

/**
 * A camera can have one transformer which includes a mask and 4 anchors.
 */
export class Transformable {
  /**
   * Transformer
   */
  @field.ref declare mask: Entity;

  /**
   * Anchors
   */
  @field.ref declare tlAnchor: Entity;
  @field.ref declare trAnchor: Entity;
  @field.ref declare blAnchor: Entity;
  @field.ref declare brAnchor: Entity;

  @field.ref declare controlPoints: Entity[];

  /**
   * Selected list
   */
  @field.backrefs(Selected, 'camera') declare selecteds: Entity[];

  /**
   * Highlighted list
   */
  @field.backrefs(Highlighted, 'camera') declare highlighteds: Entity[];

  @field({
    type: Type.staticString([
      TransformableStatus.IDLE,
      TransformableStatus.MOVING,
      TransformableStatus.MOVED,
      TransformableStatus.RESIZING,
      TransformableStatus.RESIZED,
      TransformableStatus.ROTATING,
      TransformableStatus.ROTATED,
    ]),
    default: TransformableStatus.IDLE,
  })
  declare status: TransformableStatus;

  constructor(transformable?: Partial<Transformable>) {
    Object.assign(this, transformable);
  }
}
