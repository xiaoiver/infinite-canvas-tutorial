import { Shape, ShapeAttributes } from './Shape';
import { AABB } from './AABB';

export interface RectAttributes extends ShapeAttributes {
  /**
   * The x attribute defines an x-axis coordinate in the user coordinate system.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/x
   */
  x: number;

  /**
   * The y attribute defines an x-axis coordinate in the user coordinate system.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/y
   */
  y: number;

  /**
   * The width attribute defines the horizontal length of an element in the user coordinate system.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/width
   *
   */
  width: number;

  /**
   * The height attribute defines the vertical length of an element in the user coordinate system.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/height
   *
   */
  height: number;

  /**
   * For <rect>, rx defines the x-axis radius of the ellipse used to round off the corners of the rectangle.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
   */
  rx: number;

  /**
   * For <rect>, ry defines the y-axis radius of the ellipse used to round off the corners of the rectangle.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
   */
  ry: number;
}

export class Rect extends Shape implements RectAttributes {
  #x: number;
  #y: number;
  #width: number;
  #height: number;
  #rx: number;
  #ry: number;

  constructor(attributes: Partial<RectAttributes> = {}) {
    super(attributes);

    const { x, y, width, height, rx, ry } = attributes;

    this.#x = x ?? 0;
    this.#y = y ?? 0;
    this.#width = width ?? 0;
    this.#height = height ?? 0;
    this.#rx = rx ?? ry ?? 0;
    this.#ry = ry ?? rx ?? 0;
  }

  get x() {
    return this.#x;
  }
  set x(x: number) {
    if (this.#x !== x) {
      this.#x = x;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  get y() {
    return this.#y;
  }
  set y(y: number) {
    if (this.#y !== y) {
      this.#y = y;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  get width() {
    return this.#width;
  }
  set width(width: number) {
    if (this.#width !== width) {
      this.#width = width;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  get height() {
    return this.#height;
  }
  set height(height: number) {
    if (this.#height !== height) {
      this.#height = height;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  get rx() {
    return this.#rx;
  }
  set rx(rx: number) {
    if (this.#rx !== rx) {
      this.#rx = rx;
      this.renderDirtyFlag = true;
    }
  }

  get ry() {
    return this.#ry;
  }
  set ry(ry: number) {
    if (this.#ry !== ry) {
      this.#ry = ry;
      this.renderDirtyFlag = true;
    }
  }

  containsPoint(xx: number, yy: number) {
    // const { x, y, width, height, strokeWidth } = this;

    // const halfLineWidth = strokeWidth / 2;
    // const [hasFill, hasStroke] = isFillOrStrokeAffected(
    //   this.pointerEvents,
    //   this.fill,
    //   this.stroke,
    // );
    return false;
  }

  getRenderBounds() {
    if (this.renderBoundsDirtyFlag) {
      const { strokeWidth, x, y, width, height } = this;
      const halfLineWidth = strokeWidth / 2;
      this.renderBoundsDirtyFlag = false;
      this.renderBounds = new AABB(
        x - halfLineWidth,
        y - halfLineWidth,
        x + width + halfLineWidth,
        y + height + halfLineWidth,
      );
    }
    return this.renderBounds;
  }
}
