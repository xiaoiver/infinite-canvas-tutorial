import { field } from '@lastolivegames/becsy';

export type InteractivePointerEvent =
  | PointerEvent
  | TouchEvent
  | MouseEvent
  | WheelEvent;

export class Event {
  @field.object declare value: InteractivePointerEvent | WheelEvent;
}
