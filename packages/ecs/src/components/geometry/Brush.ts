/**
 * @see https://shenciao.github.io/brush-rendering-tutorial/Basics/Basics/
 */
import { field, Type } from '@lastolivegames/becsy';
import { BrushSerializedNode, deserializeBrushPoints } from '../../utils';
import { AABB } from '../math';

export interface BrushPoint {
  x: number;
  y: number;
  radius: number;
}

export enum BrushType {
  VANILLA = 'vanilla',
  STAMP = 'stamp',
}

export class Brush {
  static getGeometryBounds(
    brush: Partial<Brush> | Partial<BrushSerializedNode>,
  ) {
    let { points } = brush;

    if (!points || points.length < 2) {
      return new AABB(0, 0, 0, 0);
    }

    if (typeof points === 'string') {
      points = deserializeBrushPoints(points);
    }

    const minX = Math.min(
      ...points.map((point) => (isNaN(point.x) ? Infinity : point.x)),
    );
    const maxX = Math.max(
      ...points.map((point) => (isNaN(point.x) ? -Infinity : point.x)),
    );
    const minY = Math.min(
      ...points.map((point) => (isNaN(point.y) ? Infinity : point.y)),
    );
    const maxY = Math.max(
      ...points.map((point) => (isNaN(point.y) ? -Infinity : point.y)),
    );

    return new AABB(minX, minY, maxX, maxY);
  }

  static getRenderBounds(brush: Brush) {
    const { minX, minY, maxX, maxY } = Brush.getGeometryBounds(brush);
    // TODO: use radius to calculate expansion
    const style_expansion = 0;
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  @field({
    type: Type.staticString([BrushType.VANILLA, BrushType.STAMP]),
    default: BrushType.VANILLA,
  })
  declare type: BrushType;

  /**
   * The points attribute defines a list of points. Each point is defined by a pair of number representing a X and a Y coordinate in the user coordinate system. If the attribute contains an odd number of coordinates, the last one will be ignored.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/points
   */
  @field({
    type: Type.object,
    default: [],
  })
  declare points: BrushPoint[];

  constructor(props?: Partial<Brush>) {
    Object.assign(this, props);
  }
}
