import { component, field, Type } from '@lastolivegames/becsy';

/**
 * A window event that is sent whenever a window's logical size has changed.
 * @see https://github.com/bevyengine/bevy/blob/main/crates/bevy_window/src/event.rs#L33-L40
 */
@component
export class WindowResized {
  /**
   * The new logical width of the window.
   */
  @field({ type: Type.float32, default: 0 }) declare width: number;

  /**
   * The new logical height of the window.
   */
  @field({ type: Type.float32, default: 0 }) declare height: number;

  constructor(width?: number, height?: number) {
    this.width = width ?? 0;
    this.height = height ?? 0;
  }
}
