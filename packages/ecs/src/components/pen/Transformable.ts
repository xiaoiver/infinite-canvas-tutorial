import { Entity, field, Type } from '@lastolivegames/becsy';
import { Selected } from './Selected';

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
   * Transformer for shapes has an OBB
   */
  @field.ref declare mask: Entity;

  /**
   * Transformer for lines
   */
  @field.ref declare lineMask: Entity;

  /**
   * Anchors in rectangle
   */
  @field.ref declare tlAnchor: Entity;
  @field.ref declare trAnchor: Entity;
  @field.ref declare blAnchor: Entity;
  @field.ref declare brAnchor: Entity;

  /**
   * Anchors in line or arrow
   */
  @field.ref declare x1y1Anchor: Entity;
  @field.ref declare x2y2Anchor: Entity;

  /**
   * Anchors in vector network
   */
  @field.object declare controlPoints: Entity[];

  /**
   * Selected list
   */
  @field.backrefs(Selected, 'camera', false) declare selecteds: Entity[];

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
