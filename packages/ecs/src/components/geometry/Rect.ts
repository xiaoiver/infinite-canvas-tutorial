import { field, Type } from '@lastolivegames/becsy';

/**
 * Defined by its position, width, and height. The rectangle may have its corners rounded.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
 */
export class Rect {
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

  /**
   * For <rect>, cornerRadius used to round off the corners of the rectangle.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
   */
  @field({ type: Type.float32, default: 0 }) declare cornerRadius: number;

  constructor(props?: Partial<Rect>) {
    this.x = props?.x;
    this.y = props?.y;
    this.width = props?.width;
    this.height = props?.height;
    this.cornerRadius = props?.cornerRadius;
  }
}
