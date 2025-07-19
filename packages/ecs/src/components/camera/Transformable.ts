import { Entity, field, Type } from '@lastolivegames/becsy';
import { Highlighted, Selected } from '../pen';

export enum TransformableType {
  OBB = 'obb',
  VECTOR_NETWORK = 'vector-network',
}

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
  @field({
    type: Type.staticString([
      TransformableType.OBB,
      TransformableType.VECTOR_NETWORK,
    ]),
    default: TransformableType.OBB,
  })
  declare type: TransformableType;

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

export enum AnchorName {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right',
  TOP_CENTER = 'top-center',
  MIDDLE_LEFT = 'middle-left',
  MIDDLE_RIGHT = 'middle-right',
  BOTTOM_CENTER = 'bottom-center',
  INSIDE = 'inside',
  OUTSIDE = 'outside',
}

export enum SelectionMode {
  IDLE = 'IDLE',
  BRUSH = 'BRUSH',
  READY_TO_SELECT = 'READY_TO_SELECT',
  SELECT = 'SELECT',
  READY_TO_MOVE = 'READY_TO_MOVE',
  MOVE = 'MOVE',
  READY_TO_RESIZE = 'READY_TO_RESIZE',
  RESIZE = 'RESIZE',
  READY_TO_ROTATE = 'READY_TO_ROTATE',
  ROTATE = 'ROTATE',
}

// export class OBBMode {
//   @field({
//     type: Type.staticString([
//       SelectionMode.IDLE,
//       SelectionMode.BRUSH,
//       SelectionMode.READY_TO_SELECT,
//       SelectionMode.SELECT,
//       SelectionMode.READY_TO_MOVE,
//       SelectionMode.MOVE,
//       SelectionMode.READY_TO_RESIZE,
//       SelectionMode.RESIZE,
//       SelectionMode.READY_TO_ROTATE,
//       SelectionMode.ROTATE,
//     ]),
//     default: SelectionMode.IDLE,
//   })
//   declare mode: SelectionMode;

//   @field({
//     type: Type.staticString([
//       AnchorName.TOP_LEFT,
//       AnchorName.TOP_RIGHT,
//       AnchorName.BOTTOM_LEFT,
//       AnchorName.BOTTOM_RIGHT,
//       AnchorName.TOP_CENTER,
//       AnchorName.MIDDLE_LEFT,
//       AnchorName.MIDDLE_RIGHT,
//       AnchorName.BOTTOM_CENTER,
//       AnchorName.INSIDE,
//       AnchorName.OUTSIDE,
//     ]),
//     default: AnchorName.TOP_LEFT,
//   })
//   declare resizingAnchorName: AnchorName;

//   @field.ref declare selectedNodes: SerializedNode[];

//   @field.ref declare obb: OBB;
//   @field.float32 declare sin: number;
//   @field.float32 declare cos: number;

//   @field.float32 declare pointerDownViewportX: number;
//   @field.float32 declare pointerDownViewportY: number;
//   @field.float32 declare pointerDownCanvasX: number;
//   @field.float32 declare pointerDownCanvasY: number;
//   @field.float32 declare pointerMoveViewportX: number;
//   @field.float32 declare pointerMoveViewportY: number;
// }
