import { field, Type } from '@lastolivegames/becsy';

/**
 * Used to create ellipses based on a center coordinate, and both their x and y radius.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/ellipse
 */
export class Ellipse {
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
   * The r attribute defines the radius of a ellipse.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
   *
   */
  @field({ type: Type.float32, default: 0 }) declare rx: number;

  /**
   * The r attribute defines the radius of a ellipse.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
   *
   */
  @field({ type: Type.float32, default: 0 }) declare ry: number;

  constructor(props?: Partial<Ellipse>) {
    this.cx = props?.cx;
    this.cy = props?.cy;
    this.rx = props?.rx;
    this.ry = props?.ry;
  }
}
