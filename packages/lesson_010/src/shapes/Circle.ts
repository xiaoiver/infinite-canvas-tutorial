import {
  Shape,
  ShapeAttributes,
  isFillOrStrokeAffected,
  strokeOffset,
} from './Shape';
import { distanceBetweenPoints } from '../utils';
import { AABB } from './AABB';

export interface CircleAttributes extends ShapeAttributes {
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
   * The r attribute defines the radius of a circle.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/r
   *
   */
  r: number;
}

export class Circle extends Shape implements CircleAttributes {
  #cx: number;
  #cy: number;
  #r: number;

  constructor(attributes: Partial<CircleAttributes> = {}) {
    super(attributes);

    const { cx, cy, r } = attributes;

    this.cx = cx ?? 0;
    this.cy = cy ?? 0;
    this.r = r ?? 0;
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

  get r() {
    return this.#r;
  }

  set r(r: number) {
    if (this.#r !== r) {
      this.#r = r;
      this.renderDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  containsPoint(x: number, y: number) {
    const {
      strokeWidth,
      strokeAlignment,
      cx,
      cy,
      r,
      pointerEvents,
      fill,
      stroke,
    } = this;

    const absDistance = distanceBetweenPoints(cx, cy, x, y);

    const [hasFill, hasStroke] = isFillOrStrokeAffected(
      pointerEvents,
      fill,
      stroke,
    );
    if (hasFill) {
      return absDistance <= r;
    }
    if (hasStroke) {
      const offset = strokeOffset(strokeAlignment, strokeWidth);
      return (
        absDistance >= r + offset - strokeWidth && absDistance <= r + offset
      );
    }
    return false;
  }

  getRenderBounds() {
    if (this.renderBoundsDirtyFlag) {
      const { strokeWidth, strokeAlignment, cx, cy, r } = this;
      const offset = strokeOffset(strokeAlignment, strokeWidth);
      this.renderBoundsDirtyFlag = false;
      this.renderBounds = new AABB(
        cx - r - offset,
        cy - r - offset,
        cx + r + offset,
        cy + r + offset,
      );
    }
    return this.renderBounds;
  }
}
