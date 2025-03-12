import { field } from '@lastolivegames/becsy';
import { Type } from '@lastolivegames/becsy';

export class InnerShadow {
  /**
   * Specifies color for the inner shadow.
   */
  @field.dynamicString(20) declare innerShadowColor: string;

  /**
   * Horizontal offset.
   *
   * Default to `0`.
   */
  @field({ type: Type.float32, default: 0 }) declare innerShadowOffsetX: number;

  /**
   * Vertical offset.
   *
   * Default to `0`.
   */
  @field({ type: Type.float32, default: 0 }) declare innerShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed.
   *
   * Default to `0`.
   */
  @field({ type: Type.float32, default: 0 })
  declare innerShadowBlurRadius: number;
}
