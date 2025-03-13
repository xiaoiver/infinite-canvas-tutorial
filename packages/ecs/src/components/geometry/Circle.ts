import { field, Type } from '@lastolivegames/becsy';

/**
 * @see https://docs.rs/bevy/latest/bevy/math/prelude/struct.Circle.html
 */
export class Circle {
  /**
   * The cx attribute define the x-axis coordinate of a center point.
   *
   * Default value is `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/cx
   */
  @field({ type: Type.float32, default: 0 }) declare cx: number;

  /**
   * The cy attribute define the y-axis coordinate of a center point.
   *
   * Default value is `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/cy
   */
  @field({ type: Type.float32, default: 0 }) declare cy: number;

  /**
   * The r attribute defines the radius of a circle.
   *
   * Default value is `0`.
   */
  @field({ type: Type.float32, default: 0 }) declare r: number;

  constructor(props?: Partial<Circle>) {
    this.cx = props?.cx;
    this.cy = props?.cy;
    this.r = props?.r;
  }
}
