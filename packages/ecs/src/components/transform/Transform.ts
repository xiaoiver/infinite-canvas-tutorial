import { field } from '@lastolivegames/becsy';
import { v2Type, Vec2 } from '../math/Vec2';

/**
 * A 2D transform.
 * @see https://github.com/tim-blackbird/bevy_mod_transform2d
 *
 * @example
 * ```ts
 * // Get the transform
 * const transform = entity.get(Transform);
 *
 * // Set the transform
 * entity.set(Transform, (transform) => {
 *   transform.translation.x = 100;
 *   return transform;
 * });
 * ```
 */
export class Transform {
  /**
   * Position of the entity. In 2d, the last value of the `Vec3` is used for z-ordering.
   */
  @field(v2Type) declare translation: Vec2;
  /**
   * Scale of the entity.
   */
  @field(v2Type) declare scale: Vec2;
  /**
   * Rotation of the entity.
   */
  @field.float32 declare rotation: number;

  constructor(
    translation: Vec2 = Vec2.ZERO,
    scale: Vec2 = Vec2.ONE,
    rotation: number = 0,
  ) {
    this.translation = translation;
    this.scale = scale;
    this.rotation = rotation;
  }

  static fromTranslation(translation: Vec2) {
    return new Transform(translation, Vec2.ONE, 0);
  }
}
