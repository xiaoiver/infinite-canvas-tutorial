import { Shape, ShapeAttributes, isFillOrStrokeAffected } from './Shape';
import { AABB } from './AABB';

export interface EllipseAttributes extends ShapeAttributes {
  /**
   * The cx attribute define the x-axis coordinate of a center point.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/cx
   */
  cx: number;

  /**
   * The cy attribute define the y-axis coordinate of a center point.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/cy
   */
  cy: number;

  /**
   * The r attribute defines the radius of a ellipse.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx
   *
   */
  rx: number;

  /**
   * The r attribute defines the radius of a ellipse.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry
   *
   */
  ry: number;
}

export class Ellipse extends Shape implements EllipseAttributes {
  #cx: number;
  #cy: number;
  #rx: number;
  #ry: number;

  constructor(attributes: Partial<EllipseAttributes> = {}) {
    super(attributes);

    const { cx, cy, rx, ry } = attributes;

    this.cx = cx ?? 0;
    this.cy = cy ?? 0;
    this.rx = rx ?? ry ?? 0;
    this.ry = ry ?? rx ?? 0;
  }

  get cx() {
    return this.#cx;
  }

  set cx(cx: number) {
    if (this.#cx !== cx) {
      this.#cx = cx;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  get cy() {
    return this.#cy;
  }

  set cy(cy: number) {
    if (this.#cy !== cy) {
      this.#cy = cy;
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
      this.renderBoundsDirtyFlag = true;
    }
  }

  get ry() {
    return this.#ry;
  }

  set ry(ry: number) {
    if (this.#ry !== ry) {
      this.#ry = ry;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  containsPoint(x: number, y: number) {
    const { cx, cy, rx, ry, strokeWidth } = this;

    const halfLineWidth = strokeWidth / 2;
    const [hasFill, hasStroke] = isFillOrStrokeAffected(
      this.pointerEvents,
      this.fill,
      this.stroke,
    );
    if (hasFill && hasStroke) {
      return isPointInEllipse(
        x,
        y,
        cx,
        cy,
        rx + halfLineWidth,
        ry + halfLineWidth,
      );
    }
    if (hasFill) {
      return isPointInEllipse(x, y, cx, cy, rx, ry);
    }
    if (hasStroke) {
      return (
        !isPointInEllipse(
          x,
          y,
          cx,
          cy,
          rx - halfLineWidth,
          ry - halfLineWidth,
        ) &&
        isPointInEllipse(x, y, cx, cy, rx + halfLineWidth, ry + halfLineWidth)
      );
    }
    return false;
  }

  getRenderBounds() {
    if (this.renderBoundsDirtyFlag) {
      const { strokeWidth, cx, cy, rx, ry } = this;
      const halfLineWidth = strokeWidth / 2;
      this.renderBoundsDirtyFlag = false;
      this.renderBounds = new AABB(
        cx - rx - halfLineWidth,
        cy - ry - halfLineWidth,
        cx + rx + halfLineWidth,
        cy + ry + halfLineWidth,
      );
    }
    return this.renderBounds;
  }
}

function isPointInEllipse(
  x: number,
  y: number,
  h: number,
  k: number,
  a: number,
  b: number,
) {
  // 计算点到椭圆中心的 x 和 y 坐标差
  const dx = x - h;
  const dy = y - k;

  // 计算点相对于椭圆中心的坐标平方，然后除以半轴长度的平方
  const squaredDistance = (dx * dx) / (a * a) + (dy * dy) / (b * b);

  // 如果计算结果小于或等于 1，则点在椭圆内
  return squaredDistance <= 1;
}
