import { Entity, field } from '@lastolivegames/becsy';

/**
 * Extrudes the host rect into a 3D box (Spline-style "3D shape" on a 2D layer).
 * {@link EnsureExtrudeMeshes} spawns a companion mesh; {@link SyncExtrude3D} keeps it aligned to rect bounds.
 */
export class Extrude3D {
  /** Extrusion depth in canvas world units (along view axis). */
  @field.float32 declare depth: number;

  /** Elevation of the unrotated front plane; the mesh center is z - depth / 2. */
  @field.float32 declare z: number;

  /** Local XYZ Euler angles composed after the source's canvas rotation. */
  @field.object declare rotation: [number, number, number];

  /** Companion mesh entity; managed by {@link EnsureExtrudeMeshes}. */
  @field.ref declare meshEntity?: Entity;

  constructor(props?: Partial<Extrude3D>) {
    if (props) {
      Object.assign(this, props);
    }
    this.depth ??= 100;
    this.z ??= 0;
    this.rotation ??= [0, 0, 0];
  }
}
