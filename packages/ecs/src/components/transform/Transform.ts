import { field } from '@lastolivegames/becsy';
import { v2Type, Vec2 } from '../math/Vec2';

/**
 * A 2D transform.
 * @see https://github.com/tim-blackbird/bevy_mod_transform2d
 *
 * @example
 * ```ts
 * // Get the transform
 * const transform = entity.read(Transform);
 *
 * // Set the transform
 * entity.write(Transform).translation.x = 100;
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
    props?: Partial<{
      translation: Vec2;
      scale: Vec2;
      rotation: number;
    }>,
  ) {
    this.translation = props?.translation ?? Vec2.ZERO;
    this.scale = props?.scale ?? Vec2.ONE;
    this.rotation = props?.rotation ?? 0;
  }

  static fromTranslation(translation: Vec2) {
    return new Transform({ translation, scale: Vec2.ONE, rotation: 0 });
  }
}
