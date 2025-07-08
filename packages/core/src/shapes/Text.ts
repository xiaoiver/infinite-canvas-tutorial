import * as d3 from 'd3-color';
import {
  getOrCreateCanvasTextMetrics,
  TextMetrics,
  yOffsetFromTextBaseline,
} from '../utils';
import { BitmapFont } from '../utils/bitmap-font/BitmapFont';
import { AABB } from './AABB';
import { GConstructor } from './mixins';
import { Shape, ShapeAttributes, strokeOffset } from './Shape';

export type TextStyleWhiteSpace = 'normal' | 'pre' | 'pre-line';
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

  /**
   * Whether to use kerning in bitmap font. Default is `true`.
   */
  bitmapFontKerning: boolean;

  /**
   * Whether to use esdt SDF generation. Default is `true`.
   */
  esdt: boolean;

  /**
   * BiDi chars after doing metrics.
   */
  bidiChars: string;

  /**
   * Specifies color for the shadow.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow#color
   */
  dropShadowColor: string;

  /**
   * Horizontal offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowOffsetX: number;

  /**
   * Vertical offset
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowOffsetY: number;

  /**
   * The larger this value, the bigger the blur, so the shadow becomes bigger and lighter.
   * Negative values are not allowed. If not specified, it will be set to `0`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/drop-shadow
   */
  dropShadowBlurRadius: number;

  /**
   * @see https://mattdesl.svbtle.com/material-design-on-the-gpu
   */
  physical: boolean;

  /**
   * The color applies to decorations, such as underlines, overlines, strikethroughs, and wavy lines like those used to mark misspellings, in the scope of the property's value.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-color
   */
  decorationColor: string;

  /**
   * Sets the kind of decoration that is used on text in an element, such as an underline or overline.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-line
   */
  decorationLine: TextDecorationLine;

  /**
   * Sets the style of the lines. e.g. `solid`, `double`, `dotted`, `dashed`, `wavy`.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-style
   */
  decorationStyle: TextDecorationStyle;

  /**
   * Sets the stroke thickness of the decoration line that is used on text in an element, such as a line-through, underline, or overline.
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-thickness
   */
  decorationThickness: number;
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
    #dropShadowColor: string;
    #dropShadowColorRGB: d3.RGBColor;
    #dropShadowOffsetX: number;
    #dropShadowOffsetY: number;
    #dropShadowBlurRadius: number;
    #decorationColor: string;
    #decorationColorRGB: d3.RGBColor;
    #decorationLine: TextDecorationLine;
    #decorationStyle: TextDecorationStyle;
    #decorationThickness: number;

    bitmapFont: BitmapFont;
    bitmapFontKerning: boolean;
    esdt: boolean;
    physical: boolean;
    bidiChars: string;

    batchable = false;

    static getGeometryBounds(
      attributes: Partial<TextAttributes> & { metrics: TextMetrics },
    ) {
      const { x, y, textAlign, textBaseline, metrics } = attributes;
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
        lineYOffset += yOffsetFromTextBaseline(
          textBaseline,
          metrics.fontMetrics,
        );
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
        bitmapFontKerning,
        esdt,
        physical,
        dropShadowColor,
        dropShadowOffsetX,
        dropShadowOffsetY,
        dropShadowBlurRadius,
        decorationColor,
        decorationLine,
        decorationStyle,
        decorationThickness,
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
      this.bitmapFontKerning = bitmapFontKerning ?? true;
      this.esdt = esdt ?? true;
      this.physical = physical ?? false;
      this.dropShadowColor = dropShadowColor ?? 'black';
      this.dropShadowOffsetX = dropShadowOffsetX ?? 0;
      this.dropShadowOffsetY = dropShadowOffsetY ?? 0;
      this.dropShadowBlurRadius = dropShadowBlurRadius ?? 0;
      this.decorationColor = decorationColor ?? 'black';
      this.decorationLine = decorationLine ?? 'none';
      this.decorationStyle = decorationStyle ?? 'solid';
      this.decorationThickness = decorationThickness ?? 1;
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
        const {
          strokeWidth,
          strokeAlignment,
          dropShadowOffsetX,
          dropShadowOffsetY,
          dropShadowBlurRadius,
        } = this;
        const offset = strokeOffset(strokeAlignment, strokeWidth);

        this.renderBoundsDirtyFlag = false;
        const { minX, minY, maxX, maxY } = this.getGeometryBounds();
        this.renderBounds = new AABB(
          minX - offset,
          minY - offset,
          maxX + offset,
          maxY + offset,
        );
        this.renderBounds.addBounds(
          new AABB(
            minX + dropShadowOffsetX - dropShadowBlurRadius,
            minY + dropShadowOffsetY - dropShadowBlurRadius,
            maxX + dropShadowOffsetX + dropShadowBlurRadius,
            maxY + dropShadowOffsetY + dropShadowBlurRadius,
          ),
        );
      }
      return this.renderBounds;
    }

    get metrics() {
      if (this.renderDirtyFlag) {
        this.#metrics = getOrCreateCanvasTextMetrics().measureText(
          this.content,
          this,
        );
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
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
        this.geometryDirtyFlag = true;
        this.materialDirtyFlag = true;
      }
    }

    get dropShadowColor() {
      return this.#dropShadowColor;
    }
    set dropShadowColor(dropShadowColor: string) {
      if (this.#dropShadowColor !== dropShadowColor) {
        this.#dropShadowColor = dropShadowColor;
        this.#dropShadowColorRGB =
          d3.rgb(dropShadowColor)?.rgb() || d3.rgb(0, 0, 0, 1);
        this.renderDirtyFlag = true;
      }
    }

    get dropShadowColorRGB() {
      return this.#dropShadowColorRGB;
    }

    get dropShadowOffsetX() {
      return this.#dropShadowOffsetX;
    }
    set dropShadowOffsetX(dropShadowOffsetX: number) {
      if (this.#dropShadowOffsetX !== dropShadowOffsetX) {
        this.#dropShadowOffsetX = dropShadowOffsetX;
        this.renderDirtyFlag = true;
      }
    }

    get dropShadowOffsetY() {
      return this.#dropShadowOffsetY;
    }
    set dropShadowOffsetY(dropShadowOffsetY: number) {
      if (this.#dropShadowOffsetY !== dropShadowOffsetY) {
        this.#dropShadowOffsetY = dropShadowOffsetY;
        this.renderDirtyFlag = true;
      }
    }

    get dropShadowBlurRadius() {
      return this.#dropShadowBlurRadius;
    }
    set dropShadowBlurRadius(dropShadowBlurRadius: number) {
      if (this.#dropShadowBlurRadius !== dropShadowBlurRadius) {
        this.#dropShadowBlurRadius = dropShadowBlurRadius;
        this.renderDirtyFlag = true;
      }
    }

    get decorationColor() {
      return this.#decorationColor;
    }
    set decorationColor(decorationColor: string) {
      if (this.#decorationColor !== decorationColor) {
        this.#decorationColor = decorationColor;
        this.#decorationColorRGB =
          d3.rgb(decorationColor)?.rgb() || d3.rgb(0, 0, 0, 1);
        this.renderDirtyFlag = true;
      }
    }

    get decorationColorRGB() {
      return this.#decorationColorRGB;
    }

    get decorationLine() {
      return this.#decorationLine;
    }
    set decorationLine(decorationLine: TextDecorationLine) {
      if (this.#decorationLine !== decorationLine) {
        this.#decorationLine = decorationLine;
        this.renderDirtyFlag = true;
      }
    }

    get decorationStyle() {
      return this.#decorationStyle;
    }
    set decorationStyle(decorationStyle: TextDecorationStyle) {
      if (this.#decorationStyle !== decorationStyle) {
        this.#decorationStyle = decorationStyle;
        this.renderDirtyFlag = true;
      }
    }

    get decorationThickness() {
      return this.#decorationThickness;
    }
    set decorationThickness(decorationThickness: number) {
      if (this.#decorationThickness !== decorationThickness) {
        this.#decorationThickness = decorationThickness;
        this.renderDirtyFlag = true;
      }
    }
  };
}
