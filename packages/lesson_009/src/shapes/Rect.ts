import { Shape, ShapeAttributes, isFillOrStrokeAffected } from './Shape';
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
   * For <rect>, cornerRadius used to round off the corners of the rectangle.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
   */
  cornerRadius: number;

  /**
   * Horizontal offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
   */
  boxShadowOffsetX: number;

  /**
   * Vertical offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
   */
  boxShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed. If not specified, it will be set to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
   */
  boxShadowBlurRadius: number;

  /**
   * Positive values will cause the shadow to expand and grow bigger,
   * negative values will cause the shadow to shrink.
   * If not specified, it will be set to 0 (that is, the shadow will be the same size as the element).
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
   */
  boxShadowSpreadRadius: number;
}

export class Rect extends Shape implements RectAttributes {
  #x: number;
  #y: number;
  #width: number;
  #height: number;
  #cornerRadius: number;
  #boxShadowOffsetX: number;
  #boxShadowOffsetY: number;
  #boxShadowBlurRadius: number;
  #boxShadowSpreadRadius: number;

  constructor(attributes: Partial<RectAttributes> = {}) {
    super(attributes);

    const {
      x,
      y,
      width,
      height,
      cornerRadius,
      boxShadowOffsetX,
      boxShadowOffsetY,
      boxShadowBlurRadius,
      boxShadowSpreadRadius,
    } = attributes;

    this.#x = x ?? 0;
    this.#y = y ?? 0;
    this.#width = width ?? 0;
    this.#height = height ?? 0;
    this.#cornerRadius = cornerRadius ?? 0;
    this.#boxShadowOffsetX = boxShadowOffsetX ?? 0;
    this.#boxShadowOffsetY = boxShadowOffsetY ?? 0;
    this.#boxShadowBlurRadius = boxShadowBlurRadius ?? 0;
    this.#boxShadowSpreadRadius = boxShadowSpreadRadius ?? 0;
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

  get cornerRadius() {
    return this.#cornerRadius;
  }
  set cornerRadius(cornerRadius: number) {
    if (this.#cornerRadius !== cornerRadius) {
      this.#cornerRadius = cornerRadius;
      this.renderDirtyFlag = true;
    }
  }

  get boxShadowOffsetX() {
    return this.#boxShadowOffsetX;
  }
  set boxShadowOffsetX(boxShadowOffsetX: number) {
    if (this.#boxShadowOffsetX !== boxShadowOffsetX) {
      this.#boxShadowOffsetX = boxShadowOffsetX;
      this.renderDirtyFlag = true;
    }
  }

  get boxShadowOffsetY() {
    return this.#boxShadowOffsetY;
  }
  set boxShadowOffsetY(boxShadowOffsetY: number) {
    if (this.#boxShadowOffsetY !== boxShadowOffsetY) {
      this.#boxShadowOffsetY = boxShadowOffsetY;
      this.renderDirtyFlag = true;
    }
  }

  get boxShadowBlurRadius() {
    return this.#boxShadowBlurRadius;
  }
  set boxShadowBlurRadius(boxShadowBlurRadius: number) {
    if (this.#boxShadowBlurRadius !== boxShadowBlurRadius) {
      this.#boxShadowBlurRadius = boxShadowBlurRadius;
      this.renderDirtyFlag = true;
    }
  }

  get boxShadowSpreadRadius() {
    return this.#boxShadowSpreadRadius;
  }
  set boxShadowSpreadRadius(boxShadowSpreadRadius: number) {
    if (this.#boxShadowSpreadRadius !== boxShadowSpreadRadius) {
      this.#boxShadowSpreadRadius = boxShadowSpreadRadius;
      this.renderDirtyFlag = true;
    }
  }

  containsPoint(xx: number, yy: number) {
    const { x, y, width, height, strokeWidth, cornerRadius } = this;
    const halfLineWidth = strokeWidth / 2;
    const [hasFill, hasStroke] = isFillOrStrokeAffected(
      this.pointerEvents,
      this.fill,
      this.stroke,
    );

    if (hasFill && hasStroke) {
      return isPointInRoundedRectangle(
        xx,
        yy,
        x - halfLineWidth,
        y - halfLineWidth,
        x + width + halfLineWidth,
        y + height + halfLineWidth,
        cornerRadius,
      );
    }
    if (hasFill) {
      return isPointInRoundedRectangle(
        xx,
        yy,
        x,
        y,
        x + width,
        y + height,
        cornerRadius,
      );
    }
    if (hasStroke) {
      return (
        !isPointInRoundedRectangle(
          xx,
          yy,
          x + halfLineWidth,
          y + halfLineWidth,
          x + width - halfLineWidth,
          y + height - halfLineWidth,
          cornerRadius,
        ) &&
        isPointInRoundedRectangle(
          xx,
          yy,
          x - halfLineWidth,
          y - halfLineWidth,
          x + width + halfLineWidth,
          y + height + halfLineWidth,
          cornerRadius,
        )
      );
    }
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

function isPointInRoundedRectangle(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
) {
  // 判断点是否在矩形的四个角的圆角内
  function isInsideCorner(
    x: number,
    y: number,
    cornerX: number,
    cornerY: number,
    r: number,
  ) {
    const distance = Math.sqrt(
      Math.pow(x - cornerX, 2) + Math.pow(y - cornerY, 2),
    );
    return distance <= r;
  }

  // 判断点是否在圆角矩形内
  if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
    // 点在矩形内部
    if (
      isInsideCorner(x, y, x1 + r, y1 + r, r) || // 左上角
      isInsideCorner(x, y, x2 - r, y1 + r, r) || // 右上角
      isInsideCorner(x, y, x2 - r, y2 - r, r) || // 右下角
      isInsideCorner(x, y, x1 + r, y2 - r, r) // 左下角
    ) {
      return true; // 点在圆角内
    }
    return !(
      x <= x1 + r ||
      x >= x2 - r || // 点在矩形的非圆角边界上
      y <= y1 + r ||
      y >= y2 - r
    );
  }
  return false; // 点不在矩形内
}
