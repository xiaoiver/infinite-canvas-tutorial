import { Entity, field } from '@lastolivegames/becsy';

export class Input {
  @field.int32.vector(2) declare pointerClient: [number, number];

  @field.int32.vector(2) declare pointerViewport: [number, number];

  @field.boolean declare pointerDownTrigger: boolean;

  @field.boolean declare pointerUpTrigger: boolean;

  /** Remains cancelled until the next press, including across render frames. */
  @field.boolean declare pointerCancelled: boolean;

  @field.int32.vector(2) declare pointerDownViewport: [number, number];

  @field.boolean declare pointerInside: boolean;

  @field.int32 declare pointerButton: number;

  @field.boolean declare doubleClickTrigger: boolean;
  @field.float32 declare lastPointerDownTime: number;

  @field.object declare key: string;

  /** Shift state at keydown, retained when keyup arrives before the next frame. */
  @field.boolean declare keyShiftKey: boolean;

  @field.boolean declare ctrlKey: boolean;

  @field.boolean declare shiftKey: boolean;

  @field.boolean declare altKey: boolean;

  @field.boolean declare metaKey: boolean;

  @field.boolean declare wheelTrigger: boolean;

  @field.float32 declare deltaX: number;

  @field.float32 declare deltaY: number;

  /**
   * Two-finger pan delta in viewport space (from touch centroid), applied after pinch zoom.
   */
  @field.float32 declare touchPanDeltaX: number;

  @field.float32 declare touchPanDeltaY: number;

  @field.float32 declare pressure: number;

  @field.object declare event: PointerEvent | WheelEvent | KeyboardEvent;
}

export class InputPoint {
  /**
   * In viewport coordinates.
   */
  @field.int32.vector(2) declare prevPoint: [number, number];

  /**
   * Canvas target.
   */
  @field.ref declare canvas: Entity;
}
