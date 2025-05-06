import { field, Type } from '@lastolivegames/becsy';

export enum UIType {
  UNKNOWN = 'unknown',
  TRANSFORMER_MASK = 'transformer-mask',
  TRANSFORMER_ANCHOR = 'transformer-anchor',
  HIGHLIGHTER = 'highlighter',
  BRUSH = 'brush',
}

/**
 * UI should be rendered on top of everything else.
 * UI should not be exported.
 */
export class UI {
  @field({
    type: Type.staticString([
      UIType.UNKNOWN,
      UIType.TRANSFORMER_MASK,
      UIType.TRANSFORMER_ANCHOR,
      UIType.HIGHLIGHTER,
      UIType.BRUSH,
    ]),
    default: UIType.UNKNOWN,
  })
  declare type: UIType;

  constructor(type?: UIType) {
    this.type = type ?? UIType.UNKNOWN;
  }
}
