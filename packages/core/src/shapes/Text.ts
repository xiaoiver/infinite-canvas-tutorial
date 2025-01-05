import { canvasTextMetrics, TextMetrics } from '../utils';
import { BitmapFont } from '../utils/bitmap-font/BitmapFont';
import { AABB } from './AABB';
import { GConstructor } from './mixins';
import { Shape, ShapeAttributes, strokeOffset } from './Shape';

export type TextStyleWhiteSpace = 'normal' | 'pre' | 'pre-line';

export interface TextAttributes extends ShapeAttributes {
  /**
   * The x-axis coordinate of the point at which to begin drawing the text, in pixels.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText#x
   */
  x: number;

  /**
   * The y-axis coordinate of the point at which to begin drawing the text, in pixels.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillText#y
   */
  y: number;

  /**
   * The text content.
   */
  content: string;

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

  /**
   * MSDF
   * @see https://github.com/soimy/msdf-bmfont-xml
   * @see https://pixijs.com/8.x/examples/text/bitmap-text
   */
  bitmapFont: BitmapFont;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Text extends TextWrapper(Shape) {}
export function TextWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class TextWrapper extends Base implements TextAttributes {
    #metrics: TextMetrics;
    #x: number;
    #y: number;
    #content: string;
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
    #bitmapFont: BitmapFont;
    static getGeometryBounds(
      attributes: Partial<TextAttributes> & { metrics: TextMetrics },
    ) {
      const { x, y, textAlign, metrics } = attributes;
      const { width, height } = metrics;

      const hwidth = width / 2;

      // default 'left'
      let lineXOffset = x;
      if (textAlign === 'center') {
        lineXOffset += -hwidth;
      } else if (textAlign === 'right' || textAlign === 'end') {
        lineXOffset += -hwidth * 2;
      }

      let lineYOffset = y;
      if (metrics.fontMetrics) {
        if (metrics.fontMetrics.fontBoundingBoxAscent) {
          lineYOffset -= metrics.fontMetrics.fontBoundingBoxAscent;
        } else {
          // TODO: approximate the ascent
        }
      }

      return new AABB(
        lineXOffset,
        lineYOffset,
        lineXOffset + width,
        lineYOffset + height,
      );
    }

    constructor(attributes: Partial<TextAttributes> = {}) {
      super(attributes);

      const {
        x,
        y,
        content,
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
        bitmapFont,
      } = attributes;

      this.#x = x ?? 0;
      this.#y = y ?? 0;
      this.#content = content ?? '';
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
      this.textAlign = textAlign ?? 'start';
      this.textBaseline = textBaseline ?? 'alphabetic';
      this.maxLines = maxLines ?? Infinity;
      this.lineHeight = lineHeight ?? 0;
      this.leading = leading ?? 0;
      this.bitmapFont = bitmapFont ?? null;
    }

    containsPoint(x: number, y: number) {
      const { minX, minY, maxX, maxY } = this.getGeometryBounds();
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    getGeometryBounds() {
      if (this.geometryBoundsDirtyFlag) {
        this.geometryBoundsDirtyFlag = false;
        this.geometryBounds = TextWrapper.getGeometryBounds(this);
      }
      return this.geometryBounds;
    }

    getRenderBounds() {
      if (this.renderBoundsDirtyFlag) {
        const { strokeWidth, strokeAlignment } = this;
        const offset = strokeOffset(strokeAlignment, strokeWidth);

        this.renderBoundsDirtyFlag = false;
        const { minX, minY, maxX, maxY } = this.getGeometryBounds();
        this.renderBounds = new AABB(
          minX - offset,
          minY - offset,
          maxX + offset,
          maxY + offset,
        );
      }
      return this.renderBounds;
    }

    get metrics() {
      if (this.renderDirtyFlag) {
        this.#metrics = canvasTextMetrics.measureText(this.content, this);
      }

      return this.#metrics;
    }

    get x() {
      return this.#x;
    }
    set x(value: number) {
      if (this.#x !== value) {
        this.#x = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get y() {
      return this.#y;
    }
    set y(value: number) {
      if (this.#y !== value) {
        this.#y = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get content() {
      return this.#content;
    }
    set content(value: string) {
      if (this.#content !== value) {
        this.#content = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get fontFamily() {
      return this.#fontFamily;
    }
    set fontFamily(value: string) {
      if (this.#fontFamily !== value) {
        this.#fontFamily = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get fontSize() {
      return this.#fontSize;
    }
    set fontSize(value: number | string) {
      if (this.#fontSize !== value) {
        this.#fontSize = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get fontWeight() {
      return this.#fontWeight;
    }
    set fontWeight(value: number) {
      if (this.#fontWeight !== value) {
        this.#fontWeight = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get fontStyle() {
      return this.#fontStyle;
    }
    set fontStyle(value: string) {
      if (this.#fontStyle !== value) {
        this.#fontStyle = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get fontVariant() {
      return this.#fontVariant;
    }
    set fontVariant(value: string) {
      if (this.#fontVariant !== value) {
        this.#fontVariant = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get letterSpacing() {
      return this.#letterSpacing;
    }
    set letterSpacing(value: number) {
      if (this.#letterSpacing !== value) {
        this.#letterSpacing = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get whiteSpace() {
      return this.#whiteSpace;
    }
    set whiteSpace(value: TextStyleWhiteSpace) {
      if (this.#whiteSpace !== value) {
        this.#whiteSpace = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get wordWrap() {
      return this.#wordWrap;
    }
    set wordWrap(value: boolean) {
      if (this.#wordWrap !== value) {
        this.#wordWrap = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get wordWrapWidth() {
      return this.#wordWrapWidth;
    }
    set wordWrapWidth(value: number) {
      if (this.#wordWrapWidth !== value) {
        this.#wordWrapWidth = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get textOverflow() {
      return this.#textOverflow;
    }
    set textOverflow(value: 'ellipsis' | 'clip' | string) {
      if (this.#textOverflow !== value) {
        this.#textOverflow = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get maxLines() {
      return this.#maxLines;
    }
    set maxLines(value: number) {
      if (this.#maxLines !== value) {
        this.#maxLines = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get lineHeight() {
      return this.#lineHeight;
    }
    set lineHeight(value: number) {
      if (this.#lineHeight !== value) {
        this.#lineHeight = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get leading() {
      return this.#leading;
    }
    set leading(value: number) {
      if (this.#leading !== value) {
        this.#leading = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get textAlign() {
      return this.#textAlign;
    }
    set textAlign(value: CanvasTextAlign) {
      if (this.#textAlign !== value) {
        this.#textAlign = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }

    get textBaseline() {
      return this.#textBaseline;
    }
    set textBaseline(value: CanvasTextBaseline) {
      if (this.#textBaseline !== value) {
        this.#textBaseline = value;
        this.renderDirtyFlag = true;
        this.geometryBoundsDirtyFlag = true;
        this.renderBoundsDirtyFlag = true;
        this.boundsDirtyFlag = true;
      }
    }
  };
}
