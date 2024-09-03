import { Shape, ShapeAttributes } from './Shape';
import { AABB } from './AABB';

export interface PolylineAttributes extends ShapeAttributes {
  /**
   * The points attribute defines a list of points. Each point is defined by a pair of number representing a X and a Y coordinate in the user coordinate system. If the attribute contains an odd number of coordinates, the last one will be ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
   */
  points: [number, number][];

  /**
   * The stroke-linecap attribute is a presentation attribute defining the shape to be used at the end of open subpaths when they are stroked.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
   */
  strokeLinecap: CanvasLineCap;

  /**
   * The stroke-linejoin attribute is a presentation attribute defining the shape to be used at the corners of paths when they are stroked.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
   */
  strokeLinejoin: CanvasLineJoin;

  /**
   * The stroke-miterlimit attribute is a presentation attribute defining a limit on the ratio of the miter length to the stroke-width used to draw a miter join.
   * When the limit is exceeded, the join is converted from a miter to a bevel.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit
   */
  strokeMiterlimit: number;

  /**
   * The stroke-dasharray attribute is a presentation attribute defining the pattern of dashes and gaps used to paint the outline of the shape;
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
   */
  strokeDasharray: number[];

  /**
   * The stroke-dashoffset attribute is a presentation attribute defining an offset on the rendering of the associated dash array.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
   */
  strokeDashoffset: number;
}

export class Polyline extends Shape implements PolylineAttributes {
  #points: [number, number][];
  #strokeLinecap: CanvasLineCap;
  #strokeLinejoin: CanvasLineJoin;
  #strokeMiterlimit: number;
  #strokeDasharray: number[];
  #strokeDashoffset: number;

  static getGeometryBounds(
    attributes: Partial<Pick<PolylineAttributes, 'points'>>,
  ) {
    // const { points } = attributes;
    return new AABB(0, 0, 0, 0);
  }

  constructor(attributes: Partial<PolylineAttributes> = {}) {
    super(attributes);

    const { points } = attributes;

    this.points = points ?? [
      [0, 0],
      [0, 0],
    ];
  }

  get points() {
    return this.#points;
  }
  set points(points: [number, number][]) {
    if (
      !this.#points ||
      !this.#points.every(
        (point, index) =>
          point[0] === points[index][0] && point[1] === points[index][1],
      )
    ) {
      this.#points = points;
      this.renderDirtyFlag = true;
      this.geometryBoundsDirtyFlag = true;
      this.renderBoundsDirtyFlag = true;
    }
  }

  get strokeLinecap() {
    return this.#strokeLinecap;
  }
  set strokeLinecap(strokeLinecap: CanvasLineCap) {
    if (this.#strokeLinecap !== strokeLinecap) {
      this.#strokeLinecap = strokeLinecap;
      this.renderDirtyFlag = true;
    }
  }

  get strokeLinejoin() {
    return this.#strokeLinejoin;
  }
  set strokeLinejoin(strokeLinejoin: CanvasLineJoin) {
    if (this.#strokeLinejoin !== strokeLinejoin) {
      this.#strokeLinejoin = strokeLinejoin;
      this.renderDirtyFlag = true;
    }
  }

  get strokeMiterlimit() {
    return this.#strokeMiterlimit;
  }
  set strokeMiterlimit(strokeMiterlimit: number) {
    if (this.#strokeMiterlimit !== strokeMiterlimit) {
      this.#strokeMiterlimit = strokeMiterlimit;
      this.renderDirtyFlag = true;
    }
  }

  get strokeDasharray() {
    return this.#strokeDasharray;
  }
  set strokeDasharray(strokeDasharray: number[]) {
    if (
      !this.#strokeDasharray ||
      !this.#strokeDasharray.every(
        (dash, index) => dash === strokeDasharray[index],
      )
    ) {
      this.#strokeDasharray = strokeDasharray;
      this.renderDirtyFlag = true;
    }
  }

  get strokeDashoffset() {
    return this.#strokeDashoffset;
  }
  set strokeDashoffset(strokeDashoffset: number) {
    if (this.#strokeDashoffset !== strokeDashoffset) {
      this.#strokeDashoffset = strokeDashoffset;
      this.renderDirtyFlag = true;
    }
  }

  containsPoint(x: number, y: number) {
    return false;
  }

  getGeometryBounds() {
    if (this.geometryBoundsDirtyFlag) {
      this.geometryBoundsDirtyFlag = false;
      this.geometryBounds = Polyline.getGeometryBounds(this);
    }
    return this.geometryBounds;
  }

  getRenderBounds() {
    if (this.renderBoundsDirtyFlag) {
      // const { points } = this;
      this.renderBoundsDirtyFlag = false;
      this.renderBounds = new AABB(0, 0, 0, 0);
    }
    return this.renderBounds;
  }
}
