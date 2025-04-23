import { Entity, field } from '@lastolivegames/becsy';

export interface Landmark {
  x: number;
  y: number;
  zoom: number;
  viewportX: number;
  viewportY: number;
  rotation: number;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AnimationEffect/getTiming
 */
export interface LandmarkAnimationEffectTiming {
  easing: string;
  duration: number;
  onframe: (t: number) => void;
  onfinish: () => void;
}

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
