import { Shape, ShapeAttributes, isFillOrStrokeAffected } from './Shape';
import { AABB } from './AABB';
import { bisect, pointToLine } from '../utils/math';
import { vec2 } from 'gl-matrix';

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

  /**
   * strokeAlignment will affect points' position
   */
  #shiftedPoints: [number, number][] = [];

  batchable = false;

  static getGeometryBounds(
    attributes: Partial<Pick<PolylineAttributes, 'points'>>,
  ) {
    const { points } = attributes;

    if (!points || points.length < 2) {
      return new AABB(0, 0, 0, 0);
    }

    // FIXME: account for strokeLinejoin & strokeLinecap
    const minX = Math.min(...points.map((point) => point[0]));
    const maxX = Math.max(...points.map((point) => point[0]));
    const minY = Math.min(...points.map((point) => point[1]));
    const maxY = Math.max(...points.map((point) => point[1]));

    return new AABB(minX, minY, maxX, maxY);
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

  private computeShiftedPoints() {
    const { strokeWidth, strokeAlignment } = this;
    this.#shiftedPoints =
      strokeAlignment === 'center'
        ? this.#points
        : shiftPoints(this.#points, strokeAlignment === 'inner', strokeWidth);
  }

  containsPoint(x: number, y: number) {
    const { strokeWidth } = this;

    // trigger recalculating shifted points
    this.getGeometryBounds();

    const [, hasStroke] = isFillOrStrokeAffected(
      this.pointerEvents,
      this.dropShadowColor,
      this.stroke,
    );

    if (hasStroke) {
      return inPolyline(this.#shiftedPoints, strokeWidth, x, y);
    }

    return false;
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getTotalLength
   */
  getTotalLength() {
    const { points } = this;
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      totalLength += Math.hypot(x2 - x1, y2 - y1);
    }
    return totalLength;
  }

  getGeometryBounds() {
    if (this.geometryBoundsDirtyFlag) {
      this.computeShiftedPoints();
      this.geometryBoundsDirtyFlag = false;
      this.geometryBounds = Polyline.getGeometryBounds({
        ...this,
        points: this.#shiftedPoints,
      });
    }
    return this.geometryBounds;
  }

  getRenderBounds() {
    if (this.renderBoundsDirtyFlag) {
      this.renderBoundsDirtyFlag = false;

      const { strokeWidth } = this;
      const halfWidth = strokeWidth / 2;
      const { minX, minY, maxX, maxY } = this.getGeometryBounds();
      this.renderBounds = new AABB(
        minX - halfWidth,
        minY - halfWidth,
        maxX + halfWidth,
        maxY + halfWidth,
      );
    }
    return this.renderBounds;
  }
}

export function inLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineWidth: number,
  x: number,
  y: number,
) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const halfWidth = lineWidth / 2;
  // 因为目前的方案是计算点到直线的距离，而有可能会在延长线上，所以要先判断是否在包围盒内
  // 这种方案会在水平或者竖直的情况下载线的延长线上有半 lineWidth 的误差
  if (
    !(
      x >= minX - halfWidth &&
      x <= maxX + halfWidth &&
      y >= minY - halfWidth &&
      y <= maxY + halfWidth
    )
  ) {
    return false;
  }

  return pointToLine(x1, y1, x2, y2, x, y) <= lineWidth / 2;
}

export function shiftPoints(
  points: [number, number][],
  innerStrokeAlignment: boolean,
  strokeWidth: number,
) {
  const shiftedPoints = [];
  points.forEach(([x, y], index) => {
    const current = vec2.fromValues(x, y);
    const prev =
      index === 0
        ? current
        : vec2.fromValues(points[index - 1][0], points[index - 1][1]);
    const next =
      index === points.length - 1
        ? current
        : vec2.fromValues(points[index + 1][0], points[index + 1][1]);

    const xBasis = vec2.sub(vec2.create(), current, prev);
    const len = vec2.length(xBasis);
    const forward = vec2.create();
    vec2.divide(forward, xBasis, vec2.fromValues(len, len));
    const norm = vec2.fromValues(forward[1], -forward[0]);

    const xBasis2 = vec2.sub(vec2.create(), next, current);
    const len2 = vec2.length(xBasis2);
    const forward2 = vec2.create();
    vec2.divide(forward2, xBasis2, vec2.fromValues(len2, len2));
    const norm2 = vec2.fromValues(forward2[1], -forward2[0]);

    const D = norm[0] * norm2[1] - norm[1] * norm2[0];
    // norm2 *= sign2;

    const lineAlignment = 2.0 * (innerStrokeAlignment ? 0 : 1) - 1.0;
    const shift = (strokeWidth / 2) * lineAlignment;

    if (len === 0) {
      vec2.add(current, current, vec2.scale(norm2, norm2, shift));
    } else if (len2 === 0) {
      vec2.add(current, current, vec2.scale(norm, norm, shift));
    } else {
      if (Math.abs(D) < 0.01) {
        vec2.add(current, current, vec2.scale(norm, norm, shift));
      } else {
        vec2.add(current, current, bisect(norm, norm2, shift));
      }
    }

    shiftedPoints.push([current[0], current[1]]);
  });
  return shiftedPoints;
}

export function inPolyline(
  points: [number, number][],
  lineWidth: number,
  x: number,
  y: number,
  // isClose: boolean,
) {
  const count = points.length;
  if (count < 2) {
    return false;
  }
  for (let i = 0; i < count - 1; i++) {
    const x1 = points[i][0];
    const y1 = points[i][1];
    const x2 = points[i + 1][0];
    const y2 = points[i + 1][1];

    if (inLine(x1, y1, x2, y2, lineWidth, x, y)) {
      return true;
    }
  }

  // if (isClose) {
  //   const first = points[0];
  //   const last = points[count - 1];
  //   if (inLine(first[0], first[1], last[0], last[1], lineWidth, x, y)) {
  //     return true;
  //   }
  // }

  return false;
}
