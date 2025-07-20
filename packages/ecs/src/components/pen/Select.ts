import { component, Entity, field, Type, World } from '@lastolivegames/becsy';
import { AnchorName } from './Anchor';
import { SerializedNode } from '../../utils';
import { OBB } from '../math';

export const pen = World.defineEnum('Pen');

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
  READY_TO_MOVE_CONTROL_POINT = 'READY_TO_MOVE_CONTROL_POINT',
  MOVE_CONTROL_POINT = 'MOVE_CONTROL_POINT',
}

export
@component(pen)
class SelectOBB {
  @field({
    type: Type.staticString([
      SelectionMode.IDLE,
      SelectionMode.BRUSH,
      SelectionMode.READY_TO_SELECT,
      SelectionMode.SELECT,
      SelectionMode.READY_TO_MOVE,
      SelectionMode.MOVE,
      SelectionMode.READY_TO_RESIZE,
      SelectionMode.RESIZE,
      SelectionMode.READY_TO_ROTATE,
      SelectionMode.ROTATE,
    ]),
    default: SelectionMode.IDLE,
  })
  declare mode: SelectionMode;

  @field({
    type: Type.staticString([
      AnchorName.TOP_LEFT,
      AnchorName.TOP_RIGHT,
      AnchorName.BOTTOM_LEFT,
      AnchorName.BOTTOM_RIGHT,
      AnchorName.TOP_CENTER,
      AnchorName.MIDDLE_LEFT,
      AnchorName.MIDDLE_RIGHT,
      AnchorName.BOTTOM_CENTER,
      AnchorName.INSIDE,
      AnchorName.OUTSIDE,
    ]),
    default: AnchorName.INSIDE,
  })
  declare resizingAnchorName: AnchorName;

  @field.object declare selectedNodes: SerializedNode[];

  @field.object declare obb: OBB;
  @field.float32 declare sin: number;
  @field.float32 declare cos: number;

  @field.float32 declare pointerDownViewportX: number;
  @field.float32 declare pointerDownViewportY: number;
  @field.float32 declare pointerDownCanvasX: number;
  @field.float32 declare pointerDownCanvasY: number;
  @field.float32 declare pointerMoveViewportX: number;
  @field.float32 declare pointerMoveViewportY: number;

  @field.ref declare brush: Entity;
}

export
@component(pen)
class SelectVectorNetwork {
  @field({
    type: Type.staticString([
      SelectionMode.IDLE,
      SelectionMode.BRUSH,
      SelectionMode.READY_TO_SELECT,
      SelectionMode.SELECT,
      SelectionMode.READY_TO_MOVE,
      SelectionMode.MOVE,
      SelectionMode.READY_TO_MOVE_CONTROL_POINT,
      SelectionMode.MOVE_CONTROL_POINT,
    ]),
    default: SelectionMode.IDLE,
  })
  declare mode: SelectionMode;

  @field.float32 declare pointerDownViewportX: number;
  @field.float32 declare pointerDownViewportY: number;
  @field.float32 declare pointerDownCanvasX: number;
  @field.float32 declare pointerDownCanvasY: number;
  @field.float32 declare pointerMoveViewportX: number;
  @field.float32 declare pointerMoveViewportY: number;

  @field.ref declare brush: Entity;

  @field.int32 declare activeControlPointIndex: number;
}
