import { field } from '@lastolivegames/becsy';
import { Mat3 } from '../math/Mat3';
import { Mat4 } from '../math/Mat4';

/**
 * Projection mode for Camera3D.
 * - 'perspective': standard perspective projection (default for standalone 3D)
 * - 'orthographic': orthographic projection (default when synced with 2D camera)
 */
export type Projection3D = 'perspective' | 'orthographic';

/**
 * Map 2D canvas world coordinates (Y down, same as SerializedNode x/y) to unified 3D space (Y up).
 */
export function canvasWorldToWorld3D(
  x: number,
  y: number,
  z = 0,
): [number, number, number] {
  return [x, -y, z];
}

/**
 * Extends the 2D {@link ComputedCamera.viewProjectionMatrix} to 4×4 for mesh3d.
 * XY/w match the 2D pipeline; optional `zScale` maps canvas-space Z into clip Z.
 */
export function mat3ViewProjectionToMat4(vp: Mat3, zScale = 0): Mat4 {
  return new Mat4(
    vp.m00,
    vp.m01,
    vp.m02,
    0,
    vp.m10,
    vp.m11,
    vp.m12,
    0,
    0,
    0,
    zScale,
    0,
    vp.m20,
    vp.m21,
    0,
    vp.m22,
  );
}

/**
 * A 3D camera component supporting both perspective and orthographic projection.
 * @see https://bevy-cheatbook.github.io/3d/camera.html
 *
 * In **unified 3D space mode** (`linked = true`), the camera automatically
 * syncs with the 2D Camera's pan/zoom so all objects live in one 3D world.
 * 2D objects sit on the z=0 plane; panning/zooming the 2D camera moves
 * this camera accordingly. In linked mode {@link MeshPipeline3D} uses the 2D
 * view-projection matrix; place extrude meshes in canvas world coordinates
 * `(x, y, z)` (Y down), not {@link canvasWorldToWorld3D}.
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
