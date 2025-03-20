import { Entity, field } from '@lastolivegames/becsy';

/**
 * @see https://bevy-cheatbook.github.io/graphics/camera.html
 * @see https://bevy-cheatbook.github.io/2d/camera.html
 *
 * @see https://bevyengine.org/examples/3d-rendering/split-screen/
 *
 * @example
 *
 * ```ts
 * const camera = this.commands.spawn(new Camera(), new Transform());
 * camera.appendChild(circle);
 * camera.appendChild(rect);
 * ```
 */

export class Camera {
  /**
   * Target
   * @see https://github.com/bevyengine/bevy/blob/main/examples/window/multiple_windows.rs#L44C17-L44C23
   */
  @field.ref declare canvas: Entity;

  constructor(camera?: Partial<Camera>) {
    Object.assign(this, camera);
  }
}
