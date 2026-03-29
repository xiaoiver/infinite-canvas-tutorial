import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { System } from '@lastolivegames/becsy';
import { Rectangle } from '@pixi/math';
import { ComputedTextMetrics, Text } from '../components';
import { DOMAdapter } from '../environment';
import { BitmapFont } from '../utils';
import { safeAddComponent } from '../history';

type CharacterWidthCache = Record<string, number>;

/** Used as max line width when `wordWrap` is off (Pretext still respects hard breaks in pre-wrap). */
const PRETEXT_SOFT_WRAP_MAX = 16_777_216;

const METRICS_STRING = '|ÉqÅ';
const BASELINE_SYMBOL = 'M';
const NEWLINES = [
  0x000a, // line feed
  0x000d, // carriage return
];
const BREAKING_SPACES = [
  0x0009, // character tabulation
  0x0020, // space
  0x2000, // en quad
  0x2001, // em quad
  0x2002, // en space
  0x2003, // em space
  0x2004, // three-per-em space
  0x2005, // four-per-em space
  0x2006, // six-per-em space
  0x2008, // punctuation space
  0x2009, // thin space
  0x200a, // hair space
  0x205f, // medium mathematical space
  0x3000, // ideographic space
];
const LATIN_REGEX =
  /[a-zA-Z0-9\u00C0-\u00D6\u00D8-\u00f6\u00f8-\u00ff!"#$%&'()*+,-./:;]/;

// Line breaking rules in CJK (Kinsoku Shori)
// Refer from https://en.wikipedia.org/wiki/Line_breaking_rules_in_East_Asian_languages
const regexCannotStartZhCn =
  /[!%),.:;?\]}¢°·'""†‡›℃∶、。〃〆〕〗〞﹚﹜！＂％＇），．：；？！］｝～]/;
const regexCannotEndZhCn = /[$(£¥·'"〈《「『【〔〖〝﹙﹛＄（．［｛￡￥]/;
const regexCannotStartZhTw =
  /[!),.:;?\]}¢·–—'"•"、。〆〞〕〉》」︰︱︲︳﹐﹑﹒﹓﹔﹕﹖﹘﹚﹜！），．：；？︶︸︺︼︾﹀﹂﹗］｜｝､]/;
const regexCannotEndZhTw = /[([{£¥'"‵〈《「『〔〝︴﹙﹛（｛︵︷︹︻︽︿﹁﹃﹏]/;
const regexCannotStartJaJp =
  /[)\]｝〕〉》」』】〙〗〟'"｠»ヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻‐゠–〜?!‼⁇⁈⁉・、:;,。.]/;
const regexCannotEndJaJp = /[([｛〔〈《「『【〘〖〝'"｟«—...‥〳〴〵]/;
const regexCannotStartKoKr =
  /[!%),.:;?\]}¢°'"†‡℃〆〈《「『〕！％），．：；？］｝]/;
const regexCannotEndKoKr = /[$([{£¥'"々〇〉》」〔＄（［｛｠￥￦#]/;

const regexCannotStart = new RegExp(
  `${regexCannotStartZhCn.source}|${regexCannotStartZhTw.source}|${regexCannotStartJaJp.source}|${regexCannotStartKoKr.source}`,
);
const regexCannotEnd = new RegExp(
  `${regexCannotEndZhCn.source}|${regexCannotEndZhTw.source}|${regexCannotEndJaJp.source}|${regexCannotEndKoKr.source}`,
);

// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/utils/fontStringFromTextStyle.ts#L17
const genericFontFamilies = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
];

// https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight#common_weight_name_mapping
export const fontWeightMap = {
  thin: 100,
  extraLight: 200,
  ultraLight: 200,
  light: 300,
  normal: 400,
  regular: 400,
  medium: 500,
  semiBold: 600,
  demiBold: 600,
  bold: 700,
  extraBold: 800,
  ultraBold: 800,
  black: 900,
  heavy: 900,
  extraBlack: 950,
  ultraBlack: 950,
};

/**
 * Generates a font style string to use for `TextMetrics.measureFont()`.
 * @param style
 * @returns Font style string, for passing to `TextMetrics.measureFont()`
 */
export function fontStringFromTextStyle(style: Partial<Text>): string {
  // build canvas api font setting from individual components. Convert a numeric style.fontSize to px
  const fontSizeString =
    typeof style.fontSize === 'number' ? `${style.fontSize}px` : style.fontSize;

  // Clean-up fontFamily property by quoting each font name
  // this will support font names with spaces
  let fontFamilies: string | string[] = style.fontFamily;

  if (!Array.isArray(style.fontFamily)) {
    fontFamilies = style.fontFamily.split(',');
  }

  for (let i = fontFamilies.length - 1; i >= 0; i--) {
    // Trim any extra white-space
    let fontFamily = fontFamilies[i].trim();

    // Check if font already contains strings
    if (
      !/([\"\'])[^\'\"]+\1/.test(fontFamily) &&
      !genericFontFamilies.includes(fontFamily)
    ) {
      fontFamily = `"${fontFamily}"`;
    }
    (fontFamilies as string[])[i] = fontFamily;
  }

  // eslint-disable-next-line max-len
  return `${style.fontStyle ?? 'normal'} ${style.fontVariant ?? 'normal'} ${
    style.fontWeight
      ? fontWeightMap[style.fontWeight] || style.fontWeight
      : 'normal'
  } ${fontSizeString} ${(fontFamilies as string[]).join(',')}`;
}

// export function textStyleFromFontString(fontString: string) {
//   const [fontStyle, fontVariant, fontWeight, fontSizeString, fontFamily] =
//     fontString.split(' ');
//   const fontSize = parseInt(fontSizeString.replace('px', ''));
//   return {
//     fontStyle,
//     fontVariant,
//     fontWeight,
//     fontSize,
//     fontFamily,
//   };
// }

export function yOffsetFromTextBaseline(
  textBaseline: CanvasTextBaseline,
  fontMetrics: Pick<
    globalThis.TextMetrics,
    | 'fontBoundingBoxAscent'
    | 'fontBoundingBoxDescent'
    | 'hangingBaseline'
    | 'ideographicBaseline'
  >,
) {
  let offset = 0;
  const {
    fontBoundingBoxAscent = 0,
    fontBoundingBoxDescent = 0,
  } = fontMetrics;

  if (textBaseline === 'alphabetic') {
    offset -= fontBoundingBoxAscent;
  } else if (textBaseline === 'middle') {
    offset -= (fontBoundingBoxAscent + fontBoundingBoxDescent) / 2;
  } else if (textBaseline === 'hanging') {
    offset = 0;
  } else if (textBaseline === 'ideographic') {
    offset -= fontBoundingBoxAscent + fontBoundingBoxDescent;
  } else if (textBaseline === 'bottom') {
    offset -= fontBoundingBoxAscent + fontBoundingBoxDescent;
  } else if (textBaseline === 'top') {
    offset = 0;
  }
  return offset;
}

export type FontMetricsResult = Pick<
  globalThis.TextMetrics,
  | 'fontBoundingBoxAscent'
  | 'fontBoundingBoxDescent'
  | 'actualBoundingBoxAscent'
  | 'actualBoundingBoxDescent'
  | 'actualBoundingBoxLeft'
  | 'actualBoundingBoxRight'
  | 'alphabeticBaseline'
  | 'hangingBaseline'
  | 'ideographicBaseline'
  | 'emHeightAscent'
  | 'emHeightDescent'
  | 'width'
> & { fontSize: number };

export type MeasureFontFn = (style: Partial<Text>) => FontMetricsResult;

/**
 * 测量给定文本字符串的像素宽度（单行）。
 * text: 要测量的字符串（可以是一行文字，也可以是单个字符）
 * style: 当前文字样式（字号、字体等）
 * 返回值为像素宽度（不含 letterSpacing；letterSpacing 由调用方叠加）。
 */
export type MeasureLineFn = (text: string, style: Partial<Text>) => number;

let canvas: OffscreenCanvas | HTMLCanvasElement;
let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const fonts: Record<string, FontMetricsResult> = {};

export let measureFontFn: MeasureFontFn = defaultMeasureFont;
let measureLineFn: MeasureLineFn = defaultMeasureLine;

export function setMeasureFontFn(fn: MeasureFontFn) {
  measureFontFn = fn;
}

export function setMeasureLineFn(fn: MeasureLineFn) {
  measureLineFn = fn;
}
export class ComputeTextMetrics extends System {
  texts = this.query((q) => q.addedOrChanged.with(Text).trackWrites);

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedTextMetrics).write);
  }

  execute() {
    this.texts.addedOrChanged.forEach((entity) => {
      const text = entity.read(Text);
      const metrics = measureText(text);

      safeAddComponent(entity, ComputedTextMetrics);

      Object.assign(entity.write(ComputedTextMetrics), metrics);
    });
  }
}

function defaultMeasureFont(style: Partial<Text>): FontMetricsResult {
  if (!canvas) {
    canvas = DOMAdapter.get().createCanvas(1, 1);
    context = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D;
  }

  const font = fontStringFromTextStyle(style);
  if (fonts[font]) {
    return fonts[font];
  }

  context.font = font;
  const {
    actualBoundingBoxAscent,
    actualBoundingBoxDescent,
    actualBoundingBoxLeft,
    actualBoundingBoxRight,
    alphabeticBaseline,
    fontBoundingBoxAscent,
    fontBoundingBoxDescent,
    hangingBaseline,
    ideographicBaseline,
    width,
    emHeightAscent,
    emHeightDescent,
  } = context.measureText(METRICS_STRING + BASELINE_SYMBOL);

  const properties: FontMetricsResult = {
    actualBoundingBoxAscent,
    actualBoundingBoxDescent,
    actualBoundingBoxLeft,
    actualBoundingBoxRight,
    alphabeticBaseline,
    fontBoundingBoxAscent,
    fontBoundingBoxDescent,
    hangingBaseline,
    ideographicBaseline,
    emHeightAscent,
    emHeightDescent,
    width,
    fontSize: actualBoundingBoxAscent + actualBoundingBoxDescent,
  };

  fonts[font] = properties;

  return properties;
}

export function measureText(
  style: Partial<Text>,
): Partial<ComputedTextMetrics> {
  if (!canvas) {
    canvas = DOMAdapter.get().createCanvas(1, 1);
    context = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D;
  }

  const content = style.content ?? '';

  const {
    wordWrap,
    letterSpacing = 0,
    textAlign = 'start',
    textBaseline = 'alphabetic',
    leading = 0,
    bitmapFont,
    bitmapFontKerning,
    fontSize,
  } = style;

  // TODO: strokeWidth
  const strokeWidth = 0;

  let lineHeight = style.lineHeight ?? 0;
  const font = fontStringFromTextStyle(style);
  let fontMetrics: FontMetricsResult;
  let scale = 1;

  if (bitmapFont) {
    const textMetrics = measureBitmapFont(bitmapFont, style.fontSize as number);
    lineHeight = textMetrics.lineHeight;
    fontMetrics = textMetrics.fontMetrics;
    scale = textMetrics.scale;
  } else {
    fontMetrics = measureFontFn(style);
    context.font = font;
  }

  lineHeight *= scale;

  // fallback in case UA disallow canvas data extraction
  if (fontMetrics.fontSize === 0) {
    fontMetrics.fontSize = fontSize as number;
  }

  const pretextLineHeight = Math.max(
    1,
    lineHeight || fontMetrics.fontSize + strokeWidth || Number(fontSize) || 16,
  );

  let lines: string[];

  if (bitmapFont) {
    const prepared = prepareWithSegments(content, font, {
      whiteSpace: 'pre-wrap',
    });
    const { lines: visualLines } = layoutWithLines(
      prepared,
      PRETEXT_SOFT_WRAP_MAX,
      pretextLineHeight,
    );
    const visualFlattened = visualLines.map((l) => l.text).join('\n');
    const outputText = wordWrap
      ? wordWrapInternal(visualFlattened, style, scale)
      : visualFlattened;
    lines = outputText.split(/(?:\r\n|\r|\n)/);
  } else {
    const prepared = prepareWithSegments(content, font, {
      whiteSpace: 'pre-wrap',
    });
    const maxW =
      wordWrap && (style.wordWrapWidth ?? 0) > 0
        ? style.wordWrapWidth! + letterSpacing
        : PRETEXT_SOFT_WRAP_MAX;
    const { lines: layoutLines } = layoutWithLines(
      prepared,
      maxW,
      pretextLineHeight,
    );
    let lineTexts = layoutLines.map((l) => l.text);
    if (
      wordWrap &&
      Number.isFinite(style.maxLines) &&
      style.maxLines > 0 &&
      lineTexts.length > style.maxLines
    ) {
      lineTexts = lineTexts.slice(0, style.maxLines);
      applyEllipsisForTruncatedLines(lineTexts, style.maxLines - 1, style, scale);
    }
    lines = lineTexts;
  }

  const bidiChars = lines.join('');
  const lineWidths = new Array<number>(lines.length);
  let maxLineWidth = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineWidth = measureTextInternal(
      lines[i],
      letterSpacing,
      bitmapFont,
      bitmapFontKerning,
      scale,
      style,
    );
    lineWidths[i] = lineWidth;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  // const {
  //   fontBoundingBoxAscent,
  //   fontBoundingBoxDescent,
  //   hangingBaseline,
  //   ideographicBaseline,
  // } = fontMetrics;

  const width = maxLineWidth + strokeWidth;
  lineHeight = lineHeight || fontMetrics.fontSize + strokeWidth;
  const height =
    Math.max(lineHeight, fontMetrics.fontSize + strokeWidth) +
    (lines.length - 1) * (lineHeight + leading);
  lineHeight += leading;

  // handle vertical text baseline
  let offsetY = 0;
  if (textBaseline === 'middle') {
    offsetY = -height / 2;
  } else if (
    textBaseline === 'bottom' ||
    textBaseline === 'alphabetic' ||
    textBaseline === 'ideographic'
  ) {
    offsetY = -height;
  } else if (textBaseline === 'top' || textBaseline === 'hanging') {
    offsetY = 0;
  }

  return {
    bidiChars,
    font,
    width,
    height,
    lines,
    lineWidths,
    lineHeight,
    maxLineWidth,
    fontMetrics,
    lineMetrics: lineWidths.map((width, i) => {
      let offsetX = 0;
      // handle horizontal text align
      if (textAlign === 'center') {
        offsetX -= width / 2;
      } else if (textAlign === 'right' || textAlign === 'end') {
        offsetX -= width;
      }

      return new Rectangle(
        offsetX - strokeWidth / 2,
        offsetY + i * lineHeight,
        width + strokeWidth,
        lineHeight,
      );
    }),
  };
}

function ellipsisString(style: Partial<Text>): string {
  const textOverflow = style.textOverflow ?? 'ellipsis';
  if (textOverflow === 'ellipsis') {
    return '...';
  }
  if (textOverflow && textOverflow !== 'clip') {
    return textOverflow;
  }
  return '';
}

function applyEllipsisToLine(
  lines: string[],
  lineIndex: number,
  ellipsis: string,
  ellipsisWidth: number,
  maxWidth: number,
  charWidth: (char: string) => number,
): void {
  if (ellipsisWidth <= 0 || ellipsisWidth > maxWidth) {
    return;
  }
  const line = lines[lineIndex] ?? '';
  let lastLineWidth = 0;
  let lastLineIndex = line.length;
  for (let i = 0; i < line.length; i++) {
    const w = charWidth(line[i]!);
    if (lastLineWidth + w + ellipsisWidth > maxWidth) {
      lastLineIndex = i;
      break;
    }
    lastLineWidth += w;
  }
  lines[lineIndex] = line.slice(0, lastLineIndex) + ellipsis;
}

/** After slicing Pretext lines to `maxLines`, trim the last line and append an ellipsis. */
function applyEllipsisForTruncatedLines(
  lines: string[],
  lastLineIndex: number,
  style: Partial<Text>,
  scale: number,
): void {
  const ellipsis = ellipsisString(style);
  if (!ellipsis) {
    return;
  }
  const { letterSpacing = 0, wordWrapWidth = 0 } = style;
  const maxWidth = wordWrapWidth + letterSpacing;
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  const cache: CharacterWidthCache = {};
  const charW = (ch: string) =>
    getFromCache(ch, letterSpacing, cache, ctx, undefined, scale, style);
  const ellipsisWidth = Array.from(ellipsis).reduce((p, c) => p + charW(c), 0);
  applyEllipsisToLine(
    lines,
    lastLineIndex,
    ellipsis,
    ellipsisWidth,
    maxWidth,
    charW,
  );
}

/**
 * @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L369
 */
function wordWrapInternal(text: string, style: Partial<Text>, scale: number) {
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  });

  const { letterSpacing = 0, maxLines, bitmapFont } = style;

  // How to handle whitespaces
  // const collapseSpaces = this.collapseSpaces(whiteSpace);
  // const collapseNewlines = this.collapseNewlines(whiteSpace);

  // whether or not spaces may be added to the beginning of lines
  // let canPrependSpaces = !collapseSpaces;

  // There is letterSpacing after every char except the last one
  // t_h_i_s_' '_i_s_' '_a_n_' '_e_x_a_m_p_l_e_' '_!
  // so for convenience the above needs to be compared to width + 1 extra letterSpace
  // t_h_i_s_' '_i_s_' '_a_n_' '_e_x_a_m_p_l_e_' '_!_
  // ________________________________________________
  // And then the final space is simply no appended to each line
  const maxWidth = style.wordWrapWidth + letterSpacing;

  const ellipsis = ellipsisString(style);

  let lines: string[] = [];
  let currentIndex = 0;
  let currentWidth = 0;

  const cache: CharacterWidthCache = {};
  const calcWidth = (char: string): number => {
    return getFromCache(
      char,
      letterSpacing,
      cache,
      context as CanvasRenderingContext2D,
      bitmapFont,
      scale,
      style,
    );
  };
  const ellipsisWidth = Array.from(ellipsis).reduce((prev, cur) => {
    return prev + calcWidth(cur);
  }, 0);

  function appendEllipsis(lineIndex: number) {
    applyEllipsisToLine(
      lines,
      lineIndex,
      ellipsis,
      ellipsisWidth,
      maxWidth,
      calcWidth,
    );
  }

  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    const prevChar = text[i - 1];
    const nextChar = text[i + 1];
    const charWidth = calcWidth(char);

    if (isNewline(char)) {
      currentIndex++;

      // exceed maxLines, break immediately
      if (currentIndex >= maxLines) {
        if (i < chars.length - 1) {
          appendEllipsis(currentIndex - 1);
        }

        break;
      }

      currentWidth = 0;
      lines[currentIndex] = '';
      continue;
    }

    if (currentWidth > 0 && currentWidth + charWidth > maxWidth) {
      if (currentIndex + 1 >= maxLines) {
        appendEllipsis(currentIndex);

        break;
      }

      currentIndex++;
      currentWidth = 0;
      lines[currentIndex] = '';

      if (isBreakingSpace(char)) {
        continue;
      }

      if (!canBreakInLastChar(char)) {
        lines = trimToBreakable(lines);
        currentWidth = sumTextWidthByCache(lines[currentIndex] || '', cache);
      }

      if (nextChar && shouldBreakByKinsokuShorui(char, nextChar)) {
        lines = trimByKinsokuShorui(lines);
        currentWidth += calcWidth(prevChar || '');
      }
    }

    currentWidth += charWidth;
    lines[currentIndex] = (lines[currentIndex] || '') + char;
  }

  return lines.join('\n');
}

function measureBitmapFont(bitmapFont: BitmapFont, fontSize: number) {
  const { fontMetrics, lineHeight } = bitmapFont;
  const scale = fontSize / bitmapFont.baseMeasurementFontSize;
  return {
    scale,
    lineHeight: lineHeight * scale,
    fontMetrics: {
      actualBoundingBoxAscent: fontMetrics.ascent * scale,
      actualBoundingBoxDescent: fontMetrics.descent * scale,
      fontSize,
    } as FontMetricsResult,
  };
}

function defaultMeasureLine(text: string, style: Partial<Text>): number {
  if (!canvas) {
    canvas = DOMAdapter.get().createCanvas(1, 1);
    context = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D;
  }
  context.font = fontStringFromTextStyle(style);
  context.letterSpacing = `${style.letterSpacing ?? 0}px`;
  return context.measureText(text).width;
}

function measureTextInternal(
  text: string,
  _letterSpacing: number,
  bitmapFont: BitmapFont,
  bitmapFontKerning: boolean,
  scale: number,
  style: Partial<Text>,
) {
  const segments = DOMAdapter.get().splitGraphemes(text);

  let metricWidth: number;
  let boundsWidth: number;
  let previousChar: string;
  if (bitmapFont) {
    metricWidth = segments.reduce((sum, char) => {
      const advance = bitmapFont.chars[char]?.xAdvance;
      const kerning =
        (bitmapFontKerning &&
          previousChar &&
          bitmapFont.chars[char]?.kerning[previousChar]) ||
        0;

      previousChar = char;
      return sum + ((advance + kerning) * scale || 0);
    }, 0);
    boundsWidth = metricWidth;
  } else {
    metricWidth = measureLineFn(text, style);
    boundsWidth = metricWidth;
  }

  return Math.max(metricWidth, boundsWidth);
}

function isBreakingSpace(char: string): boolean {
  return BREAKING_SPACES.includes(char.charCodeAt(0));
}

function isNewline(char: string): boolean {
  return NEWLINES.includes(char.charCodeAt(0));
}

function trimToBreakable(prev: string[]): string[] {
  const next = [...prev];
  const prevLine = next[next.length - 2];

  const index = findBreakableIndex(prevLine);
  if (index === -1 || !prevLine) return next;

  const trimmedChar = prevLine.slice(index, index + 1);
  const isTrimmedWithSpace = isBreakingSpace(trimmedChar);

  const trimFrom = index + 1;
  const trimTo = index + (isTrimmedWithSpace ? 0 : 1);
  next[next.length - 1] += prevLine.slice(trimFrom, prevLine.length);
  next[next.length - 2] = prevLine.slice(0, trimTo);

  return next;
}

function shouldBreakByKinsokuShorui(
  char: string | undefined,
  nextChar: string,
): boolean {
  if (isBreakingSpace(nextChar)) return false;

  if (char) {
    // Line breaking rules in CJK (Kinsoku Shori)
    if (regexCannotEnd.exec(nextChar) || regexCannotStart.exec(char)) {
      return true;
    }
  }
  return false;
}

function trimByKinsokuShorui(prev: string[]): string[] {
  const next = [...prev];
  const prevLine = next[next.length - 2];
  if (!prevLine) {
    return prev;
  }

  const lastChar = prevLine[prevLine.length - 1];

  next[next.length - 2] = prevLine.slice(0, -1);
  next[next.length - 1] = lastChar + next[next.length - 1];
  return next;
}

function canBreakInLastChar(char: string | undefined): boolean {
  if (char && LATIN_REGEX.test(char)) return false;
  return true;
}

function sumTextWidthByCache(text: string, cache: { [key in string]: number }) {
  return text.split('').reduce((sum: number, c) => {
    if (!cache[c]) throw Error('cannot count the word without cache');
    return sum + cache[c];
  }, 0);
}

function findBreakableIndex(line: string): number {
  for (let i = line.length - 1; i >= 0; i--) {
    if (!LATIN_REGEX.test(line[i])) return i;
  }
  return -1;
}

function getFromCache(
  key: string,
  letterSpacing: number,
  cache: CharacterWidthCache,
  _context: CanvasRenderingContext2D,
  bitmapFont: BitmapFont | undefined,
  scale: number,
  style: Partial<Text>,
): number {
  let width = cache[key];
  if (typeof width !== 'number') {
    const spacing = key.length * letterSpacing;
    width =
      (bitmapFont
        ? bitmapFont.chars[key]?.xAdvance || 0
        : measureLineFn(key, style)) *
        scale +
      spacing;
    cache[key] = width;
  }
  return width;
}

// function collapseSpaces(whiteSpace: TextStyleWhiteSpace) {
//   return whiteSpace === 'normal' || whiteSpace === 'pre-line';
// }

// function collapseNewlines(whiteSpace: TextStyleWhiteSpace) {
//   return whiteSpace === 'normal';
// }
