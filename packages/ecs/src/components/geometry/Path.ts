import { field, Type } from '@lastolivegames/becsy';
import { AABB } from '../math';
import { Stroke } from '../renderable';
import { parsePath } from '../../utils';

export enum TesselationMethod {
  EARCUT = 'earcut',
  LIBTESS = 'libtess',
}

/**
 * It is the generic element to define a shape. All the basic shapes can be created with a path element.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
 */
export class Path {
  static getGeometryBounds(
    path: Partial<Path>,
    computed?: Partial<ComputedPoints>,
  ) {
    const { d } = path;
    let { points } = computed || {};
    if (!d) {
      return new AABB(Infinity, Infinity, -Infinity, -Infinity);
    }

    if (!points) {
      const { subPaths } = parsePath(d);
      points = subPaths.map((subPath) =>
        subPath
          .getPoints()
          .map((point) => [point[0], point[1]] as [number, number]),
      );
    }

    const flattedPoints = points.flat();

    // FIXME: account for strokeLinejoin & strokeLinecap
    const minX = Math.min(...flattedPoints.map((point) => point[0]));
    const maxX = Math.max(...flattedPoints.map((point) => point[0]));
    const minY = Math.min(...flattedPoints.map((point) => point[1]));
    const maxY = Math.max(...flattedPoints.map((point) => point[1]));

    return new AABB(minX, minY, maxX, maxY);
  }

  static getRenderBounds(
    path: Path,
    computed: ComputedPoints,
    stroke?: Stroke,
  ) {
    const { width = 0, linecap = 'butt' } = stroke ?? {};

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

    const { minX, minY, maxX, maxY } = Path.getGeometryBounds(path, computed);
    return new AABB(
      minX - style_expansion,
      minY - style_expansion,
      maxX + style_expansion,
      maxY + style_expansion,
    );
  }

  /**
   * Defines a path to be drawn.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
   */
  @field({ type: Type.dynamicString(1000) }) declare d: string;

  /**
   * The fill rule to use for rendering the path.
   *
   * Default to `nonzero`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule
   */
  @field({
    type: Type.staticString(['nonzero', 'evenodd']),
    default: 'nonzero',
  })
  declare fillRule: CanvasFillRule;

  /**
   * The tesselation method to use for rendering the path.
   *
   * Default to `earcut`.
   */
  @field({ type: Type.staticString(['earcut', 'libtess']), default: 'earcut' })
  declare tessellationMethod: TesselationMethod;

  constructor(props?: Partial<Path>) {
    this.d = props?.d;
    this.fillRule = props?.fillRule;
    this.tessellationMethod = props?.tessellationMethod;
  }
}

export class ComputedPoints {
  /**
   * Sampled points of the path.
   */
  @field({ type: Type.object }) declare points: [number, number][][];

  /**
   * Account for stroke alignment.
   */
  @field({ type: Type.object }) declare shiftedPoints: [number, number][];
}
