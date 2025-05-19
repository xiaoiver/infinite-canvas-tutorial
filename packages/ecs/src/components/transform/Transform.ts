import { field, Type } from '@lastolivegames/becsy';
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
  @field({ type: v2Type, default: Vec2.ZERO }) declare translation: Vec2;
  /**
   * Scale of the entity.
   */
  @field({ type: v2Type, default: Vec2.ONE }) declare scale: Vec2;
  /**
   * Rotation of the entity.
   */
  @field({ type: Type.float32, default: 0 }) declare rotation: number;

  constructor(
    props?: Partial<{
      translation: { x: number; y: number };
      scale: { x: number; y: number };
      rotation: number;
    }>,
  ) {
    this.translation = props?.translation
      ? new Vec2(props.translation.x ?? 0, props.translation.y ?? 0)
      : Vec2.ZERO;
    this.scale = props?.scale
      ? new Vec2(props.scale.x ?? 1, props.scale.y ?? 1)
      : Vec2.ONE;
    this.rotation = props?.rotation ?? 0;
  }
}
