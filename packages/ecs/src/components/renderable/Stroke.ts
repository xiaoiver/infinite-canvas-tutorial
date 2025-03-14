import { field, Type } from '@lastolivegames/becsy';

export class Stroke {
  /**
   * It is a presentation attribute defining the color used to paint the outline of the shape.
   *
   * Default to `none`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke
   */
  @field({ type: Type.dynamicString(20), default: 'none' })
  declare color: string;

  /**
   * It is a presentation attribute defining the width of the stroke to be applied to the shape.
   *
   * Default value is `1`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-width
   */
  @field({ type: Type.float32, default: 1 }) declare width: number;

  /**
   * This property allows to align a stroke along the outline of the current object.
   *
   * Default value is `center`.
   *
   * @see https://www.w3.org/TR/svg-strokes/#SpecifyingStrokeAlignment
   *
   * * `center`: This value indicates that the stroke for each subpath is positioned along the outline of the current stroke. The extends of the stroke increase to both sides of the outline accordingly dependent on the `stroke-width`.
   * * `inner`: This value indicates that the stroke area is defined by the outline of each subpath of the current object and the computed value of the `stroke-width` property as offset orthogonal from the outline into the fill area of each subpath. The `stroke-linejoin` property must be ignored.
   * * `outer`: This value indicates that the stroke area is defined by the outline of each subpath of the current object and the computed value of the `stroke-width` property as offset orthogonal from the outline away from the fill area of each subpath.
   */
  @field({
    type: Type.staticString(['center', 'inner', 'outer']),
    default: 'center',
  })
  declare alignment: 'center' | 'inner' | 'outer';

  /**
   * The stroke-linecap attribute is a presentation attribute defining the shape to be used at the end of open subpaths when they are stroked.
   *
   * Default value is `butt`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
   */
  @field({
    type: Type.staticString(['butt', 'round', 'square']),
    default: 'butt',
  })
  declare linecap: CanvasLineCap;

  /**
   * The stroke-linejoin attribute is a presentation attribute defining the shape to be used at the corners of paths when they are stroked.
   *
   * Default value is `miter`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin
   */
  @field({
    type: Type.staticString(['miter', 'round', 'bevel']),
    default: 'miter',
  })
  declare linejoin: CanvasLineJoin;

  /**
   * The stroke-miterlimit attribute is a presentation attribute defining a limit on the ratio of the miter length to the stroke-width used to draw a miter join.
   * When the limit is exceeded, the join is converted from a miter to a bevel.
   *
   * Default value is `4`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit
   */
  @field({ type: Type.float32, default: 4 }) declare miterlimit: number;

  /**
   * The stroke-dasharray attribute is a presentation attribute defining the pattern of dashes and gaps used to paint the outline of the shape;
   *
   * Default value is `[]`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray
   */
  @field({ type: Type.vector(Type.float32, 2), default: [0, 0] })
  declare dasharray: [number, number];

  /**
   * The stroke-dashoffset attribute is a presentation attribute defining an offset on the rendering of the associated dash array.
   *
   * Default value is `0`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset
   */
  @field({ type: Type.float32, default: 0 }) declare dashoffset: number;

  constructor(props?: Partial<Stroke>) {
    this.color = props?.color;
    this.width = props?.width;
    this.alignment = props?.alignment;
    this.linecap = props?.linecap;
    this.linejoin = props?.linejoin;
    this.miterlimit = props?.miterlimit;
    this.dasharray = props?.dasharray;
    this.dashoffset = props?.dashoffset;
  }
}
