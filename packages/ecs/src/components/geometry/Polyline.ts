import { field, Type } from '@lastolivegames/becsy';

/**
 * Basic shape that creates straight lines connecting several points.
 * Typically a polyline is used to create open shapes as the last point doesn't have to be connected to the first point.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/polyline
 */
export class Polyline {
  /**
   * The points attribute defines a list of points. Each point is defined by a pair of number representing a X and a Y coordinate in the user coordinate system. If the attribute contains an odd number of coordinates, the last one will be ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
   */
  @field({ type: Type.object }) declare points: [number, number][];

  constructor(props?: Partial<Polyline>) {
    this.points = props?.points;
  }
}
