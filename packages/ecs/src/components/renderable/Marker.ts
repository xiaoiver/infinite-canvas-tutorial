import { field, Type } from '@lastolivegames/becsy';

export class Marker {
  /**
   * Defines the arrowhead or polymarker that will be drawn at the first vertex of the given shape.
   *
   * Default value is `none`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-start
   */
  @field({
    type: Type.staticString(['none', 'line']),
    default: 'none',
  })
  declare start: 'none' | 'line';

  /**
   * Defines the arrowhead or polymarker that will be drawn at the final vertex of the given shape.
   *
   * Default value is `none`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/marker-end
   */
  @field({
    type: Type.staticString(['none', 'line']),
    default: 'none',
  })
  declare end: 'none' | 'line';

  @field({
    type: Type.float32,
    default: 3,
  })
  declare factor: number;

  constructor(props?: Partial<Marker>) {
    Object.assign(this, props);
  }
}
