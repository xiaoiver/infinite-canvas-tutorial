import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { Stroke } from '../renderable';
import { LineSerializedNode } from '../../utils';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/line
 */
export class Line {
  static getGeometryBounds(line: Partial<Line> | Partial<LineSerializedNode>) {
    const { x1, y1, x2, y2 } = line;
    return new AABB(
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2),
    );
  }

  static getRenderBounds(line: Line, stroke?: Stroke) {
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

    const { minX, minY, maxX, maxY } = Line.getGeometryBounds(line);
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  /**
   * The x1 attribute is used to specify the first x-coordinate for drawing an SVG element that requires more than one coordinate.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/x1
   */
  @field({ type: Type.float32, default: 0 }) declare x1: number;
  @field({ type: Type.float32, default: 0 }) declare y1: number;
  @field({ type: Type.float32, default: 0 }) declare x2: number;
  @field({ type: Type.float32, default: 0 }) declare y2: number;

  constructor(props?: Partial<Line>) {
    Object.assign(this, props);
  }
}
