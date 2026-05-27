import { field } from '@lastolivegames/becsy';

/**
 * Projection mode for Camera3D.
 * - 'perspective': standard perspective projection (default for standalone 3D)
 * - 'orthographic': orthographic projection (default when synced with 2D camera)
 */
export type Projection3D = 'perspective' | 'orthographic';

/**
 * A 3D camera component supporting both perspective and orthographic projection.
 * @see https://bevy-cheatbook.github.io/3d/camera.html
 *
 * In **unified 3D space mode** (`linked = true`), the camera automatically
 * syncs with the 2D Camera's pan/zoom so all objects live in one 3D world.
 * 2D objects sit on the z=0 plane; panning/zooming the 2D camera moves
 * this camera accordingly.
 *
 * @see https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
 */
export class Camera3D {
  /**
   * Vertical field of view in radians (used in perspective mode).
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

  /**
   * Projection type: 'perspective' or 'orthographic'.
   * Default is 'perspective'. When `linked` is true, defaults to 'orthographic'.
   */
  @field.object declare projection: Projection3D;

  /**
   * When true, the CameraSync system automatically updates this camera's
   * eye/center based on the 2D Camera's pan (x, y) and zoom.
   * This enables the unified 3D space where 2D objects on the z=0 plane
   * and 3D objects coexist under one camera.
   */
  @field.boolean declare linked: boolean;

  /**
   * Base distance from the z=0 plane when zoom=1 (linked mode only).
   * The actual eye.z = baseDistance / zoom.
   */
  @field.float32 declare baseDistance: number;

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
    this.linked ??= false;
    this.baseDistance ??= 5;
    // Default to orthographic when linked to 2D camera (unified space).
    this.projection ??= this.linked ? 'orthographic' : 'perspective';
  }
}
