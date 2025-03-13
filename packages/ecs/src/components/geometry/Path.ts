import { field, Type } from '@lastolivegames/becsy';

export enum TesselationMethod {
  EARCUT = 'earcut',
  LIBTESS = 'libtess',
}

/**
 * It is the generic element to define a shape. All the basic shapes can be created with a path element.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
 */
export class Path {
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

/**
 * Sampled points of the path.
 */
export class ComputedPoints {
  @field({ type: Type.object }) declare points: [number, number][][];
}
