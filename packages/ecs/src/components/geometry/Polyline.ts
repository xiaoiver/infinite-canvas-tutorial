import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { Stroke } from '../renderable';

/**
 * Basic shape that creates straight lines connecting several points.
 * Typically a polyline is used to create open shapes as the last point doesn't have to be connected to the first point.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polyline
 */
export class Polyline {
  static getGeometryBounds(polyline: Polyline) {
    const { points } = polyline;

    if (!points || points.length < 2) {
      return new AABB(0, 0, 0, 0);
    }

    // FIXME: account for strokeLinejoin & strokeLinecap
    const minX = Math.min(
      ...points.map((point) => (isNaN(point[0]) ? Infinity : point[0])),
    );
    const maxX = Math.max(
      ...points.map((point) => (isNaN(point[0]) ? -Infinity : point[0])),
    );
    const minY = Math.min(
      ...points.map((point) => (isNaN(point[1]) ? Infinity : point[1])),
    );
    const maxY = Math.max(
      ...points.map((point) => (isNaN(point[1]) ? -Infinity : point[1])),
    );

    return new AABB(minX, minY, maxX, maxY);
  }

  static getRenderBounds(polyline: Polyline, stroke?: Stroke) {
    const { width, linecap } = stroke ?? {};

    let style_expansion = 0.5;
    if (linecap === 'square') {
      style_expansion = Math.SQRT1_2;
    }

    // const stroke_is_rectilinear = true;
    // if (
    //   strokeLinejoin === 'miter' &&
    //   style_expansion < Math.SQRT2 * strokeMiterlimit &&
    //   !stroke_is_rectilinear
    // ) {
    //   style_expansion = Math.SQRT2 * strokeMiterlimit;
    // }

    style_expansion *= width;

    const { minX, minY, maxX, maxY } = Polyline.getGeometryBounds(polyline);
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  /**
   * The points attribute defines a list of points. Each point is defined by a pair of number representing a X and a Y coordinate in the user coordinate system. If the attribute contains an odd number of coordinates, the last one will be ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
   */
  @field({
    type: Type.object,
    default: [
      [0, 0],
      [0, 0],
    ],
  })
  declare points: [number, number][];

  constructor(props?: Partial<Polyline>) {
    this.points = props?.points;
  }
}
