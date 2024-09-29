import { Shape, ShapeAttributes } from './Shape';
import { AABB } from './AABB';

export interface PolylineAttributes extends ShapeAttributes {
  /**
   * The points attribute defines a list of points. Each point is defined by a pair of number representing a X and a Y coordinate in the user coordinate system. If the attribute contains an odd number of coordinates, the last one will be ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
   */
  points: [number, number][];
}

export class Polyline extends Shape implements PolylineAttributes {
  #points: [number, number][];

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
