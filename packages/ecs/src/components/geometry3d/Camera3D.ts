import { field } from '@lastolivegames/becsy';

/**
 * A 3D camera component with perspective projection.
 * @see https://bevy-cheatbook.github.io/3d/camera.html
 *
 * Camera3D renders after Camera (2D) to the same render target,
 * similar to how Bevy's Core3dPlugin works.
 */
export class Camera3D {
  /**
   * Vertical field of view in radians.
   */
  @field.float32 declare fovy: number;

  /**
   * Near clipping plane distance.
   */
  @field.float32 declare near: number;

  /**
   * Far clipping plane distance.
   */
  @field.float32 declare far: number;

  /**
   * Eye position [x, y, z].
   */
  @field.object declare eye: [number, number, number];

  /**
   * Look-at target position [x, y, z].
   */
  @field.object declare center: [number, number, number];

  /**
   * Up direction [x, y, z].
   */
  @field.object declare up: [number, number, number];

  /**
   * Render order. Higher values render later.
   * Set to -1 to render 3D before 2D (default behavior).
   */
  @field.int32 declare order: number;

  /**
   * Whether to clear the color buffer before rendering.
   * Default is true. Set to false when rendering after another camera.
   */
  @field.boolean declare clearColor: boolean;

  constructor(camera?: Partial<Camera3D>) {
    if (camera) {
      Object.assign(this, camera);
    }
    // Defaults
    this.fovy ??= Math.PI / 4; // 45 degrees
    this.near ??= 0.1;
    this.far ??= 1000;
    this.eye ??= [0, 0, 5];
    this.center ??= [0, 0, 0];
    this.up ??= [0, 1, 0];
    this.order ??= -1;
    this.clearColor ??= true;
  }
}
