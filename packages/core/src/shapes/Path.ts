import { Shape, ShapeAttributes } from './Shape';
import { AABB } from './AABB';
import { parsePath } from '../utils';
import { GConstructor } from './mixins';

export enum TesselationMethod {
  EARCUT,
  LIBTESS,
}

export interface PathAttributes extends ShapeAttributes {
  /**
   * Defines a path to be drawn.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
   */
  d: string;

  /**
   * The tesselation method to use for rendering the path.
   */
  tessellationMethod?: TesselationMethod;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Path extends PathWrapper(Shape) {}
export function PathWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class PathWrapper extends Base implements PathAttributes {
    #d: string;
    points: [number, number][][] = [];
    tessellationMethod: TesselationMethod;

    batchable = false;

    static getGeometryBounds(
      attributes: Partial<
        Pick<PathAttributes, 'd'> & { points: [number, number][][] }
      >,
    ) {
      const { d, points } = attributes;

      if (!d) {
        return new AABB(0, 0, 0, 0);
      }

      const flattedPoints = points.flat();

      // FIXME: account for strokeLinejoin & strokeLinecap
      const minX = Math.min(...flattedPoints.map((point) => point[0]));
      const maxX = Math.max(...flattedPoints.map((point) => point[0]));
      const minY = Math.min(...flattedPoints.map((point) => point[1]));
      const maxY = Math.max(...flattedPoints.map((point) => point[1]));

      return new AABB(minX, minY, maxX, maxY);
    }

    constructor(attributes: Partial<PathAttributes> = {}) {
      super(attributes);

      const { d } = attributes;

      this.d = d;
      this.tessellationMethod = TesselationMethod.EARCUT;
    }

    get d() {
      return this.#d;
    }
    set d(d: string) {
      if (this.#d !== d) {
        this.#d = d;

        const { subPaths } = parsePath(d);
        const points = subPaths.map((subPath) =>
          subPath
            .getPoints()
            .map((point) => [point[0], point[1]] as [number, number]),
        );
        this.points = points;

        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    containsPoint(x: number, y: number) {
      // const { strokeWidth } = this;

      // trigger recalculating shifted points
      this.getGeometryBounds();

      // const [, hasStroke] = isFillOrStrokeAffected(
      //   this.pointerEvents,
      //   this.dropShadowColor,
      //   this.stroke,
      // );

      // if (hasStroke) {
      //   return inPath(this.#shiftedPoints, strokeWidth, x, y);
      // }

      return false;
    }

    /**
     * @see https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getTotalLength
     */
    getTotalLength() {
      // const { points } = this;
      // let totalLength = 0;
      // for (let i = 0; i < points.length - 1; i++) {
      //   const [x1, y1] = points[i];
      //   const [x2, y2] = points[i + 1];
      //   totalLength += Math.hypot(x2 - x1, y2 - y1);
      // }
      // return totalLength;
      return 0;
    }

    getGeometryBounds() {
      if (this.geometryBoundsDirtyFlag) {
        this.geometryBoundsDirtyFlag = false;
        this.geometryBounds = Path.getGeometryBounds(this);
      }
      return this.geometryBounds;
    }

    getRenderBounds() {
      if (this.renderBoundsDirtyFlag) {
        this.renderBoundsDirtyFlag = false;

        const { strokeWidth, strokeLinecap, strokeLinejoin, strokeMiterlimit } =
          this;

        let style_expansion = 0.5;
        if (strokeLinecap === 'square') {
          style_expansion = Math.SQRT1_2;
        }

        const stroke_is_rectilinear = true;
        if (
          strokeLinejoin === 'miter' &&
          style_expansion < Math.SQRT2 * strokeMiterlimit &&
          !stroke_is_rectilinear
        ) {
          style_expansion = Math.SQRT2 * strokeMiterlimit;
        }

        style_expansion *= strokeWidth;

        const { minX, minY, maxX, maxY } = this.getGeometryBounds();
        this.renderBounds = new AABB(
          minX - style_expansion,
          minY - style_expansion,
          maxX + style_expansion,
          maxY + style_expansion,
        );
      }
      return this.renderBounds;
    }
  };
}
