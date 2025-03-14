import { field, Type } from '@lastolivegames/becsy';

export class DropShadow {
  /**
   * Specifies color for the shadow.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow#color
   */
  @field({ type: Type.dynamicString(20), default: 'black' })
  declare color: string;

  /**
   * Horizontal offset.
   *
   * Default to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  @field({ type: Type.float32, default: 0 }) declare offsetX: number;

  /**
   * Vertical offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  @field({ type: Type.float32, default: 0 }) declare offsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed.
   *
   * Default to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  @field({ type: Type.float32, default: 0 })
  declare blurRadius: number;

  constructor(props?: Partial<DropShadow>) {
    this.color = props?.color;
    this.blurRadius = props?.blurRadius;
    this.offsetX = props?.offsetX;
    this.offsetY = props?.offsetY;
  }
}
