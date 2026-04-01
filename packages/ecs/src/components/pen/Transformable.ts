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
   * Transformer for polylines
   */
  @field.ref declare polylineMask: Entity;

  /**
   * Transformer for cropping elements
   */
  @field.ref declare cropMask: Entity;

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
   * Anchors in vector network or polyline
   */
  @field.object declare controlPoints: Entity[];
  @field.object declare segmentMidpoints: Entity[];
  @field.object declare controlPointMeta: unknown[];
  @field.object declare pathControlCommands: (string | number)[][];
  /** Path 编辑时锚点与 handle 之间的虚线（本地 Line 实体） */
  @field.object declare pathHandleLines: Entity[];

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

  /**
   * During resize, local width/height from the drag (Konva delta), for word-wrapped text only.
   * When reflow reduces line count, intrinsic text height can shrink while the handle rect does not — use these for the transformer so the box does not "collapse" mid-drag. -1 means unset.
   */
  @field({ type: Type.float32, default: -1 }) declare resizeWidth: number;
  @field({ type: Type.float32, default: -1 }) declare resizeHeight: number;

  constructor(transformable?: Partial<Transformable>) {
    Object.assign(this, transformable);
  }
}
