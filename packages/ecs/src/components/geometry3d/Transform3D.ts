import { field } from '@lastolivegames/becsy';

/**
 * A 3D transform component storing position, rotation (Euler angles), and scale.
 * @see https://docs.rs/bevy/latest/bevy/transform/components/struct.Transform.html
 */
export class Transform3D {
  /**
   * Translation [x, y, z].
   */
  @field.object declare translation: [number, number, number];

  /**
   * Rotation as Euler angles [rx, ry, rz] in radians.
   */
  @field.object declare rotation: [number, number, number];

  /**
   * Scale [sx, sy, sz].
   */
  @field.object declare scale: [number, number, number];

  constructor(transform?: Partial<Transform3D>) {
    if (transform) {
      Object.assign(this, transform);
    }
    this.translation ??= [0, 0, 0];
    this.rotation ??= [0, 0, 0];
    this.scale ??= [1, 1, 1];
  }
}
