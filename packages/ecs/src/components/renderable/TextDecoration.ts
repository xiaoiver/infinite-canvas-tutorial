import { field, Type } from '@lastolivegames/becsy';

export type TextDecorationLine =
  | 'underline'
  | 'overline'
  | 'line-through'
  | 'none';
export type TextDecorationStyle =
  | 'solid'
  | 'double'
  | 'dotted'
  | 'dashed'
  | 'wavy';

export class TextDecoration {
  /**
   * The color applies to decorations, such as underlines, overlines, strikethroughs, and wavy lines like those used to mark misspellings, in the scope of the property's value.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-color
   */
  @field({ type: Type.dynamicString(20), default: 'black' })
  declare color: string;

  /**
   * Sets the kind of decoration that is used on text in an element, such as an underline or overline.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-line
   */
  @field({
    type: Type.staticString(['underline', 'overline', 'line-through', 'none']),
    default: 'none',
  })
  declare line: TextDecorationLine;

  /**
   * Sets the style of the lines. e.g. `solid`, `double`, `dotted`, `dashed`, `wavy`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-style
   */
  @field({
    type: Type.staticString(['solid', 'double', 'dotted', 'dashed', 'wavy']),
    default: 'solid',
  })
  declare style: TextDecorationStyle;

  /**
   * Sets the stroke thickness of the decoration line that is used on text in an element, such as a line-through, underline, or overline.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-thickness
   */
  @field({ type: Type.float32, default: 0 })
  declare thickness: number;

  constructor(props?: Partial<TextDecoration>) {
    Object.assign(this, props);
  }
}
