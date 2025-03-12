import { field, Type } from '@lastolivegames/becsy';

export class DropShadow {
  /**
   * Specifies color for the shadow.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow#color
   */
  @field.dynamicString(20) declare dropShadowColor: string;
  // dropShadowColorRGB: d3.RGBColor;

  /**
   * Horizontal offset.
   *
   * Default to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  @field({ type: Type.float32, default: 0 }) declare dropShadowOffsetX: number;

  /**
   * Vertical offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  @field({ type: Type.float32, default: 0 }) declare dropShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed.
   *
   * Default to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  @field({ type: Type.float32, default: 0 })
  declare dropShadowBlurRadius: number;
}
