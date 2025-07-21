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

export interface SelectOBB {
  mode: SelectionMode;
  resizingAnchorName: AnchorName;
  selectedNodes: SerializedNode[];

  obb: OBB;
  sin: number;
  cos: number;

  // @field.float32 declare pointerDownViewportX: number;
  // @field.float32 declare pointerDownViewportY: number;
  // @field.float32 declare pointerDownCanvasX: number;
  // @field.float32 declare pointerDownCanvasY: number;
  pointerMoveViewportX: number;
  pointerMoveViewportY: number;

  brush: Entity;
}

// export
// @component(pen)
// class SelectVectorNetwork {
//   @field({
//     type: Type.staticString([
//       SelectionMode.IDLE,
//       SelectionMode.BRUSH,
//       SelectionMode.READY_TO_SELECT,
//       SelectionMode.SELECT,
//       SelectionMode.READY_TO_MOVE,
//       SelectionMode.MOVE,
//       SelectionMode.READY_TO_MOVE_CONTROL_POINT,
//       SelectionMode.MOVE_CONTROL_POINT,
//     ]),
//     default: SelectionMode.IDLE,
//   })
//   declare mode: SelectionMode;

//   @field.float32 declare pointerMoveViewportX: number;
//   @field.float32 declare pointerMoveViewportY: number;

//   @field.int32 declare activeControlPointIndex: number;
// }
