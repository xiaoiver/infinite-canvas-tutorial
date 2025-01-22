import {
  Shape,
  ShapeAttributes,
  isFillOrStrokeAffected,
  strokeOffset,
} from './Shape';
import { distanceBetweenPoints } from '../utils';
import { AABB } from './AABB';
import { GConstructor } from './mixins';

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

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Circle extends CircleWrapper(Shape) {}
export function CircleWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class CircleWrapper extends Base implements CircleAttributes {
    #cx: number;
    #cy: number;
    #r: number;

    static getGeometryBounds(
      attributes: Partial<Pick<CircleAttributes, 'cx' | 'cy' | 'r'>>,
    ) {
      const { cx = 0, cy = 0, r = 0 } = attributes;
      return new AABB(cx - r, cy - r, cx + r, cy + r);
    }

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
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.geometryDirtyFlag = true;
      }
    }

    get cy() {
      return this.#cy;
    }

    set cy(cy: number) {
      if (this.#cy !== cy) {
        this.#cy = cy;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.geometryDirtyFlag = true;
      }
    }

    get r() {
      return this.#r;
    }

    set r(r: number) {
      if (this.#r !== r) {
        this.#r = r;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
        this.geometryDirtyFlag = true;
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
      const offset = strokeOffset(strokeAlignment, strokeWidth);

      const [hasFill, hasStroke] = isFillOrStrokeAffected(
        pointerEvents,
        fill,
        stroke,
      );
      if (hasFill && hasStroke) {
        return absDistance <= r + offset;
      }
      if (hasFill) {
        return absDistance <= r;
      }
      if (hasStroke) {
        return (
          absDistance >= r + offset - strokeWidth && absDistance <= r + offset
        );
      }
      return false;
    }

    getGeometryBounds() {
      if (this.geometryBoundsDirtyFlag) {
        this.geometryBoundsDirtyFlag = false;
        this.geometryBounds = Circle.getGeometryBounds(this);
      }
      return this.geometryBounds;
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
  };
}
