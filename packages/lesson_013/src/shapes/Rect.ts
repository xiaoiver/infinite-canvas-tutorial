import * as d3 from 'd3-color';
import {
  Shape,
  ShapeAttributes,
  isFillOrStrokeAffected,
  strokeOffset,
} from './Shape';
import { AABB } from './AABB';
import { GConstructor } from './mixins';

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
   * Specifies color for the shadow.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow#color
   */
  dropShadowColor: string;

  /**
   * Horizontal offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowOffsetX: number;

  /**
   * Vertical offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed. If not specified, it will be set to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowBlurRadius: number;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Rect extends RectWrapper(Shape) {}
export function RectWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class RectWrapper extends Base implements RectAttributes {
    #x: number;
    #y: number;
    #width: number;
    #height: number;
    #cornerRadius: number;
    #dropShadowColor: string;
    #dropShadowColorRGB: d3.RGBColor;
    #dropShadowOffsetX: number;
    #dropShadowOffsetY: number;
    #dropShadowBlurRadius: number;

    onGeometryChanged?: () => void;

    static getGeometryBounds(
      attributes: Partial<Pick<RectAttributes, 'x' | 'y' | 'width' | 'height'>>,
    ) {
      const { x = 0, y = 0, width = 0, height = 0 } = attributes;
      return new AABB(x, y, x + width, y + height);
    }

    constructor(attributes: Partial<RectAttributes> = {}) {
      super(attributes);

      const {
        x,
        y,
        width,
        height,
        cornerRadius,
        dropShadowColor,
        dropShadowOffsetX,
        dropShadowOffsetY,
        dropShadowBlurRadius,
      } = attributes;

      this.x = x ?? 0;
      this.y = y ?? 0;
      this.width = width ?? 0;
      this.height = height ?? 0;
      this.cornerRadius = cornerRadius ?? 0;
      this.dropShadowColor = dropShadowColor ?? 'black';
      this.dropShadowOffsetX = dropShadowOffsetX ?? 0;
      this.dropShadowOffsetY = dropShadowOffsetY ?? 0;
      this.dropShadowBlurRadius = dropShadowBlurRadius ?? 0;
    }

    get x() {
      return this.#x;
    }
    set x(x: number) {
      if (this.#x !== x) {
        this.#x = x;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.onGeometryChanged?.();
      }
    }

    get y() {
      return this.#y;
    }
    set y(y: number) {
      if (this.#y !== y) {
        this.#y = y;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.onGeometryChanged?.();
      }
    }

    get width() {
      return this.#width;
    }
    set width(width: number) {
      if (this.#width !== width) {
        this.#width = width;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.onGeometryChanged?.();
      }
    }

    get height() {
      return this.#height;
    }
    set height(height: number) {
      if (this.#height !== height) {
        this.#height = height;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.onGeometryChanged?.();
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

    get dropShadowColor() {
      return this.#dropShadowColor;
    }
    set dropShadowColor(dropShadowColor: string) {
      if (this.#dropShadowColor !== dropShadowColor) {
        this.#dropShadowColor = dropShadowColor;
        this.#dropShadowColorRGB = d3.rgb(dropShadowColor);
        this.renderDirtyFlag = true;
      }
    }

    get dropShadowColorRGB() {
      return this.#dropShadowColorRGB;
    }

    get dropShadowOffsetX() {
      return this.#dropShadowOffsetX;
    }
    set dropShadowOffsetX(dropShadowOffsetX: number) {
      if (this.#dropShadowOffsetX !== dropShadowOffsetX) {
        this.#dropShadowOffsetX = dropShadowOffsetX;
        this.renderDirtyFlag = true;
      }
    }

    get dropShadowOffsetY() {
      return this.#dropShadowOffsetY;
    }
    set dropShadowOffsetY(dropShadowOffsetY: number) {
      if (this.#dropShadowOffsetY !== dropShadowOffsetY) {
        this.#dropShadowOffsetY = dropShadowOffsetY;
        this.renderDirtyFlag = true;
      }
    }

    get dropShadowBlurRadius() {
      return this.#dropShadowBlurRadius;
    }
    set dropShadowBlurRadius(dropShadowBlurRadius: number) {
      if (this.#dropShadowBlurRadius !== dropShadowBlurRadius) {
        this.#dropShadowBlurRadius = dropShadowBlurRadius;
        this.renderDirtyFlag = true;
      }
    }

    containsPoint(xx: number, yy: number) {
      const {
        x,
        y,
        width,
        height,
        strokeWidth,
        strokeAlignment,
        cornerRadius,
        pointerEvents,
        stroke,
        fill,
      } = this;
      const offset = strokeOffset(strokeAlignment, strokeWidth);
      const [hasFill, hasStroke] = isFillOrStrokeAffected(
        pointerEvents,
        fill,
        stroke,
      );

      if (hasFill && hasStroke) {
        return isPointInRoundedRectangle(
          xx,
          yy,
          x - offset,
          y - offset,
          x + width + offset,
          y + height + offset,
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
        const inner = offset - strokeWidth;
        return (
          !isPointInRoundedRectangle(
            xx,
            yy,
            x - inner,
            y - inner,
            x + width + inner,
            y + height + inner,
            cornerRadius,
          ) &&
          isPointInRoundedRectangle(
            xx,
            yy,
            x - offset,
            y - offset,
            x + width + offset,
            y + height + offset,
            cornerRadius,
          )
        );
      }
      return false;
    }

    getGeometryBounds() {
      if (this.geometryBoundsDirtyFlag) {
        this.geometryBoundsDirtyFlag = false;
        this.geometryBounds = RectWrapper.getGeometryBounds(this);
      }
      return this.geometryBounds;
    }

    getRenderBounds() {
      if (this.renderBoundsDirtyFlag) {
        const {
          x,
          y,
          width,
          height,
          strokeWidth,
          strokeAlignment,
          dropShadowOffsetX,
          dropShadowOffsetY,
          dropShadowBlurRadius,
        } = this;
        const offset = strokeOffset(strokeAlignment, strokeWidth);
        this.renderBoundsDirtyFlag = false;
        this.renderBounds = new AABB(
          x - offset,
          y - offset,
          x + width + offset,
          y + height + offset,
        );
        this.renderBounds.addBounds(
          new AABB(
            x + dropShadowOffsetX - dropShadowBlurRadius,
            y + dropShadowOffsetY - dropShadowBlurRadius,
            x + dropShadowOffsetX + width + dropShadowBlurRadius,
            y + dropShadowOffsetY + height + dropShadowBlurRadius,
          ),
        );
      }
      return this.renderBounds;
    }
  };
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
