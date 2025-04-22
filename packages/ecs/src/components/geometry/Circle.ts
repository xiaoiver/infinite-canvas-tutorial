import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { strokeOffset } from '../../utils';
import { Stroke } from '../renderable';

/**
 * @see https://docs.rs/bevy/latest/bevy/math/prelude/struct.Circle.html
 */
export class Circle {
  static getGeometryBounds(circle: Partial<Circle>) {
    const { cx, cy, r } = circle;
    return new AABB(cx - r, cy - r, cx + r, cy + r);
  }

  static getRenderBounds(circle: Partial<Circle>, stroke?: Stroke) {
    const { cx, cy, r } = circle;
    const offset = strokeOffset(stroke);
    return new AABB(
      cx - r - offset,
      cy - r - offset,
      cx + r + offset,
      cy + r + offset,
    );
  }

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
