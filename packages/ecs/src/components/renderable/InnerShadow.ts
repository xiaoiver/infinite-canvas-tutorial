import { field, Type } from '@lastolivegames/becsy';

export class InnerShadow {
  /**
   * Specifies color for the inner shadow.
   */
  @field.dynamicString(20) declare color: string;

  /**
   * Horizontal offset.
   *
   * Default to `0`.
   */
  @field({ type: Type.float32, default: 0 }) declare offsetX: number;

  /**
   * Vertical offset.
   *
   * Default to `0`.
   */
  @field({ type: Type.float32, default: 0 }) declare offsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed.
   *
   * Default to `0`.
   */
  @field({ type: Type.float32, default: 0 })
  declare blurRadius: number;

  constructor(props?: Partial<InnerShadow>) {
    Object.assign(this, props);
  }
}
