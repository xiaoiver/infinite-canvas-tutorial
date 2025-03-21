import { Entity, field } from '@lastolivegames/becsy';

export class Input {
  @field.int32.vector(2) declare pointerWorld: [number, number];

  @field.boolean declare pointerDownTrigger: boolean;

  @field.boolean declare pointerUpTrigger: boolean;

  @field.boolean declare ctrlKey: boolean;

  @field.boolean declare shiftKey: boolean;

  @field.boolean declare metaKey: boolean;

  @field.boolean declare wheelTrigger: boolean;

  @field.float32 declare deltaX: number;

  @field.float32 declare deltaY: number;
}

export class InputPoint {
  @field.int32.vector(2) declare prevPoint: [number, number];

  /**
   * Canvas target.
   */
  @field.ref declare canvas: Entity;
}
