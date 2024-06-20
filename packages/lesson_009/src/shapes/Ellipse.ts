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
    const squareX = (x - cx) * (x - cx);
    const squareY = (y - cy) * (y - cy);
    if (hasFill && hasStroke) {
      return (
        ellipseDistance(
          squareX,
          squareY,
          rx + halfLineWidth,
          ry + halfLineWidth,
        ) <= 1
      );
    }
    if (hasFill) {
      return ellipseDistance(squareX, squareY, rx, ry) <= 1;
    }
    if (hasStroke) {
      return (
        ellipseDistance(
          squareX,
          squareY,
          rx - halfLineWidth,
          ry - halfLineWidth,
        ) >= 1 &&
        ellipseDistance(
          squareX,
          squareY,
          rx + halfLineWidth,
          ry + halfLineWidth,
        ) <= 1
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

function ellipseDistance(
  squareX: number,
  squareY: number,
  rx: number,
  ry: number,
) {
  return squareX / (rx * rx) + squareY / (ry * ry);
}
