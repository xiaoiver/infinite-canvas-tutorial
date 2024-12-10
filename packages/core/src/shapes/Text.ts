import { GConstructor } from './mixins';
import { Shape, ShapeAttributes } from './Shape';

export type TextStyleWhiteSpace = 'normal' | 'pre' | 'pre-line';

export interface TextAttributes extends ShapeAttributes {
  /**
   * Specifies a prioritized list of one or more font family names and/or generic family names for the selected element.
   * e.g. `'Arial, Helvetica, sans-serif'`
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-family
   */
  fontFamily: string;

  /**
   * Sets the size of the font.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-size
   */
  fontSize: number | string;

  /**
   * Specifies the weight of the font.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight
   */
  fontWeight: number;

  /**
   * Sets whether a font should be styled with a normal, italic, or oblique face from its font-family.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-style
   */
  fontStyle: string;

  /**
   * Set all the font variants for a font.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant
   */
  fontVariant: string;

  /**
   * Specifies the spacing between letters when drawing text in px.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing
   */
  letterSpacing: number;

  /**
   * Sets how white space inside an element is handled.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/white-space
   */
  whiteSpace: TextStyleWhiteSpace;

  wordWrap: boolean;

  wordWrapWidth: number;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow
   * @example
   * ```ts
   * new Text({
      text: 'abcde...',
      textOverflow: TextOverflow.ELLIPSIS,
      wordWrapWidth: 100,
      maxLines: 3,
    });
   */
  textOverflow: 'ellipsis' | 'clip' | string;

  /**
   * CanvasKit ParagraphStyle
   * ```ts
   * export interface ParagraphStyle {
      ellipsis?: string;
      maxLines?: number;
    }
   * ```
   */
  maxLines: number;

  /**
   * Text alignment used when drawing text.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign
   */
  textAlign: CanvasTextAlign;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
   */
  textBaseline: CanvasTextBaseline;

  /**
   * Sets the height of a line box in horizontal writing modes. In vertical writing modes, it sets the width of a line box.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/line-height
   */
  lineHeight: number;

  /**
   * Sets the distance between lines in px.
   */
  leading: number;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Text extends TextWrapper(Shape) {}
export function TextWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class TextWrapper extends Base implements TextAttributes {
    #fontFamily: string;
    #fontSize: number | string;
    #fontWeight: number;
    #fontStyle: string;
    #fontVariant: string;
    #letterSpacing: number;
    #whiteSpace: TextStyleWhiteSpace;
    #wordWrap: boolean;
    #wordWrapWidth: number;
    #textOverflow: 'ellipsis' | 'clip' | string;
    #maxLines: number;
    #lineHeight: number;
    #leading: number;
    #textAlign: CanvasTextAlign;
    #textBaseline: CanvasTextBaseline;

    constructor(attributes: Partial<TextAttributes> = {}) {
      super(attributes);

      const {
        fontFamily,
        fontVariant,
        fontSize,
        fontWeight,
        fontStyle,
        wordWrap,
        wordWrapWidth,
        letterSpacing,
        whiteSpace,
        textOverflow,
        textAlign,
        textBaseline,
        maxLines,
        lineHeight,
        leading,
      } = attributes;

      this.fontFamily = fontFamily ?? 'sans-serif';
      this.fontSize = fontSize ?? 12;
      this.fontWeight = fontWeight ?? 400;
      this.fontStyle = fontStyle ?? 'normal';
      this.fontVariant = fontVariant ?? 'normal';
      this.letterSpacing = letterSpacing ?? 0;
      this.whiteSpace = whiteSpace ?? 'normal';
      this.wordWrap = wordWrap ?? false;
      this.wordWrapWidth = wordWrapWidth ?? 0;
      this.textOverflow = textOverflow ?? 'ellipsis';
      this.textAlign = textAlign ?? 'left';
      this.textBaseline = textBaseline ?? 'alphabetic';
      this.maxLines = maxLines ?? Infinity;
      this.lineHeight = lineHeight ?? 0;
      this.leading = leading ?? 0;
    }

    get fontFamily() {
      return this.#fontFamily;
    }
    set fontFamily(value: string) {
      if (this.#fontFamily !== value) {
        this.#fontFamily = value;
      }
    }

    get fontSize() {
      return this.#fontSize;
    }
    set fontSize(value: number | string) {
      if (this.#fontSize !== value) {
        this.#fontSize = value;
      }
    }

    get fontWeight() {
      return this.#fontWeight;
    }
    set fontWeight(value: number) {
      if (this.#fontWeight !== value) {
        this.#fontWeight = value;
      }
    }

    get fontStyle() {
      return this.#fontStyle;
    }
    set fontStyle(value: string) {
      if (this.#fontStyle !== value) {
        this.#fontStyle = value;
      }
    }

    get fontVariant() {
      return this.#fontVariant;
    }
    set fontVariant(value: string) {
      if (this.#fontVariant !== value) {
        this.#fontVariant = value;
      }
    }

    get letterSpacing() {
      return this.#letterSpacing;
    }
    set letterSpacing(value: number) {
      if (this.#letterSpacing !== value) {
        this.#letterSpacing = value;
      }
    }

    get whiteSpace() {
      return this.#whiteSpace;
    }
    set whiteSpace(value: TextStyleWhiteSpace) {
      if (this.#whiteSpace !== value) {
        this.#whiteSpace = value;
      }
    }

    get wordWrap() {
      return this.#wordWrap;
    }
    set wordWrap(value: boolean) {
      if (this.#wordWrap !== value) {
        this.#wordWrap = value;
      }
    }

    get wordWrapWidth() {
      return this.#wordWrapWidth;
    }
    set wordWrapWidth(value: number) {
      if (this.#wordWrapWidth !== value) {
        this.#wordWrapWidth = value;
      }
    }

    get textOverflow() {
      return this.#textOverflow;
    }
    set textOverflow(value: 'ellipsis' | 'clip' | string) {
      if (this.#textOverflow !== value) {
        this.#textOverflow = value;
      }
    }

    get maxLines() {
      return this.#maxLines;
    }
    set maxLines(value: number) {
      if (this.#maxLines !== value) {
        this.#maxLines = value;
      }
    }

    get lineHeight() {
      return this.#lineHeight;
    }
    set lineHeight(value: number) {
      if (this.#lineHeight !== value) {
        this.#lineHeight = value;
      }
    }

    get leading() {
      return this.#leading;
    }
    set leading(value: number) {
      if (this.#leading !== value) {
        this.#leading = value;
      }
    }

    get textAlign() {
      return this.#textAlign;
    }
    set textAlign(value: CanvasTextAlign) {
      if (this.#textAlign !== value) {
        this.#textAlign = value;
      }
    }

    get textBaseline() {
      return this.#textBaseline;
    }
    set textBaseline(value: CanvasTextBaseline) {
      if (this.#textBaseline !== value) {
        this.#textBaseline = value;
      }
    }
  };
}
