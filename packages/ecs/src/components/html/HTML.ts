import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';

export class HTML {
  static getGeometryBounds(html: Partial<HTML>) {
    const { x = 0, y = 0, width = 0, height = 0 } = html;
    return new AABB(
      Math.min(x, x + width),
      Math.min(y, y + height),
      Math.max(x, x + width),
      Math.max(y, y + height),
    );
  }

  @field({ type: Type.object, default: '' }) declare html: string;

  /**
   * The x attribute defines an x-axis coordinate in the user coordinate system.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/x
   */
  @field({ type: Type.float32, default: 0 }) declare x: number;

  /**
   * The y attribute defines an x-axis coordinate in the user coordinate system.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/y
   */
  @field({ type: Type.float32, default: 0 }) declare y: number;

  /**
   * The width attribute defines the horizontal length of an element in the user coordinate system.
   * Negative values are allowed.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/width
   *
   */
  @field({ type: Type.float32, default: 0 }) declare width: number;

  /**
   * The height attribute defines the vertical length of an element in the user coordinate system.
   * Negative values are allowed.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/height
   *
   */
  @field({ type: Type.float32, default: 0 }) declare height: number;

  constructor(props?: Partial<HTML>) {
    if (props) {
      Object.assign(this, props);
    }
  }
}
