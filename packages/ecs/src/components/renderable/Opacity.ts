import { field, Type } from '@lastolivegames/becsy';

export class Opacity {
  /**
   * It specifies the transparency of an object or of a group of objects,
   * that is, the degree to which the background behind the element is overlaid.
   *
   * Default value is `1`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/opacity
   */
  @field({ type: Type.float32, default: 1 }) declare opacity: number;

  /**
   * It is a presentation attribute defining the opacity of the paint server (color, gradient, pattern, etc.) applied to the stroke of a shape.
   *
   * Default value is `1`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-opacity
   */
  @field({ type: Type.float32, default: 1 }) declare strokeOpacity: number;

  /**
   * It is a presentation attribute defining the opacity of the paint server (color, gradient, pattern, etc.) applied to a shape.
   *
   * Default value is `1`.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-opacity
   */
  @field({ type: Type.float32, default: 1 }) declare fillOpacity: number;
}
