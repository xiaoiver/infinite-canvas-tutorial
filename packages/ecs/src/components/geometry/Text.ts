import { field, Type } from '@lastolivegames/becsy';
import { Rectangle } from '@pixi/math';
import { BitmapFont } from '../../utils';

export type TextStyleWhiteSpace = 'normal' | 'pre' | 'pre-line';

/**
 * Draws a graphics element consisting of text.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/text
 */
export class Text {
  /**
   * The x-axis coordinate of the point at which to begin drawing the text, in pixels.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText#x
   */
  @field({ type: Type.float32, default: 0 }) declare x: number;

  /**
   * The y-axis coordinate of the point at which to begin drawing the text, in pixels.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText#y
   */
  @field({ type: Type.float32, default: 0 }) declare y: number;

  /**
   * The text content.
   */
  @field({ type: Type.dynamicString(1000), default: '' })
  declare content: string;

  /**
   * Specifies a prioritized list of one or more font family names and/or generic family names for the selected element.
   * e.g. `'Arial, Helvetica, sans-serif'`
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-family
   */
  @field({ type: Type.dynamicString(100), default: 'sans-serif' })
  declare fontFamily: string;

  /**
   * Sets the size of the font.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-size
   */
  @field({ type: Type.float32, default: 12 }) declare fontSize: number | string;

  /**
   * Specifies the weight of the font.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight
   */
  @field({ type: Type.float32, default: 400 }) declare fontWeight: number;

  /**
   * Sets whether a font should be styled with a normal, italic, or oblique face from its font-family.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-style
   */
  @field({ type: Type.dynamicString(100), default: 'normal' })
  declare fontStyle: string;

  /**
   * Set all the font variants for a font.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant
   */
  @field({ type: Type.dynamicString(100), default: 'normal' })
  declare fontVariant: string;

  /**
   * Specifies the spacing between letters when drawing text in px.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/letterSpacing
   */
  @field({ type: Type.float32, default: 0 }) declare letterSpacing: number;

  /**
   * Sets how white space inside an element is handled.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/white-space
   */
  @field({
    type: Type.staticString(['normal', 'pre', 'pre-line']),
    default: 'normal',
  })
  declare whiteSpace: TextStyleWhiteSpace;

  /**
   * Text alignment used when drawing text.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign
   */
  @field({
    type: Type.staticString(['start', 'end', 'left', 'right', 'center']),
    default: 'start',
  })
  declare textAlign: CanvasTextAlign;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
   */
  @field({
    type: Type.staticString([
      'top',
      'hanging',
      'middle',
      'alphabetic',
      'ideographic',
      'bottom',
    ]),
    default: 'alphabetic',
  })
  declare textBaseline: CanvasTextBaseline;

  /**
   * Sets the height of a line box in horizontal writing modes. In vertical writing modes, it sets the width of a line box.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/line-height
   */
  @field({ type: Type.float32, default: 0 }) declare lineHeight: number;

  /**
   * Sets the distance between lines in px.
   */
  @field({ type: Type.float32, default: 0 }) declare leading: number;

  /**
   * MSDF
   * @see https://github.com/soimy/msdf-bmfont-xml
   * @see https://pixijs.com/8.x/examples/text/bitmap-text
   */
  @field({ type: Type.object }) declare bitmapFont: BitmapFont;

  /**
   * Whether to use kerning in bitmap font. Default is `true`.
   */
  @field({ type: Type.boolean, default: true })
  declare bitmapFontKerning: boolean;

  /**
   * Whether to use esdt SDF generation. Default is `true`.
   */
  @field({ type: Type.boolean, default: true }) declare esdt: boolean;

  /**
   * @see https://mattdesl.svbtle.com/material-design-on-the-gpu
   */
  @field({ type: Type.boolean, default: false }) declare physical: boolean;

  /**
   * Whether to wrap the text.
   */
  @field({ type: Type.boolean, default: false }) declare wordWrap: boolean;

  /**
   * The width of the text.
   */
  @field({ type: Type.float32, default: 0 }) declare wordWrapWidth: number;

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
  @field({ type: Type.staticString(['ellipsis', 'clip']) })
  declare textOverflow: 'ellipsis' | 'clip' | string;

  /**
   * CanvasKit ParagraphStyle
   * ```ts
   * export interface ParagraphStyle {
      ellipsis?: string;
      maxLines?: number;
    }
   * ```
   */
  @field({ type: Type.int32, default: Infinity }) declare maxLines: number;

  constructor(props?: Partial<Text>) {
    Object.assign(this, props);
  }
}

export class ComputedTextMetrics {
  /**
   * BiDi chars after doing metrics.
   */
  @field({ type: Type.object }) declare bidiChars: string;

  /**
   * fontStyle + fontVariant + fontWeight + fontSize + fontFamily
   */
  @field({ type: Type.dynamicString(100), default: '' }) declare font: string;

  @field({ type: Type.float32, default: 0 }) declare width: number;
  @field({ type: Type.float32, default: 0 }) declare height: number;

  /**
   * Split text by new line.
   */
  @field({ type: Type.object })
  declare lines: string[];

  /**
   * Width of each line.
   */
  @field({ type: Type.float32, default: [] }) declare lineWidths: number[];

  /**
   * Height of each line.
   */
  @field({ type: Type.float32, default: 0 }) declare lineHeight: number;

  /**
   * Max width of all lines.
   */
  @field({ type: Type.float32, default: 0 }) declare maxLineWidth: number;

  /**
   * FontSize.
   */
  @field({ type: Type.object }) declare fontMetrics: globalThis.TextMetrics & {
    fontSize: number;
  };

  /**
   * Detailed line metrics.
   */
  @field({ type: Type.object }) declare lineMetrics: Rectangle[];
}
