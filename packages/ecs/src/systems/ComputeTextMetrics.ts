import { System } from '@lastolivegames/becsy';
import { Rectangle } from '@pixi/math';
import bidiFactory from 'bidi-js';
import ArabicReshaper from 'arabic-reshaper';
import { ComputedTextMetrics, Text } from '../components';
import { DOMAdapter } from '../environment';
import { BitmapFont } from '../utils';
import { safeAddComponent } from '../history';

type TextSegment = { text: string; direction: 'ltr' | 'rtl' };
type CharacterWidthCache = Record<string, number>;

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
const fontWeightMap = {
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
    hangingBaseline = 0,
    ideographicBaseline = 0,
  } = fontMetrics;
  if (textBaseline === 'alphabetic') {
    offset -= fontBoundingBoxAscent;
  } else if (textBaseline === 'middle') {
    offset -= (fontBoundingBoxAscent + fontBoundingBoxDescent) / 2;
  } else if (textBaseline === 'hanging') {
    offset -= hangingBaseline;
  } else if (textBaseline === 'ideographic') {
    offset -= ideographicBaseline;
  } else if (textBaseline === 'bottom') {
    offset -= fontBoundingBoxAscent + fontBoundingBoxDescent;
  } else if (textBaseline === 'top') {
    offset = 0;
  }
  return offset;
}

let canvas: OffscreenCanvas | HTMLCanvasElement;
let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const fonts: Record<string, globalThis.TextMetrics & { fontSize: number }> = {};
const bidi = bidiFactory();
const bidiCache: Record<string, string> = {};
export class ComputeTextMetrics extends System {
  texts = this.query((q) => q.addedOrChanged.with(Text).trackWrites);

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedTextMetrics).write);
  }

  execute() {
    this.texts.addedOrChanged.forEach((entity) => {
      const text = entity.read(Text);
      const bidiChars = computeBidi(text.content);
      const metrics = measureText(text);

      safeAddComponent(entity, ComputedTextMetrics);

      Object.assign(entity.write(ComputedTextMetrics), {
        bidiChars,
        ...metrics,
      });
    });
  }
}

function measureFont(font: string) {
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

  const properties: globalThis.TextMetrics & { fontSize: number } = {
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

  const { content } = style;
  const bidiChars = bidiCache[content] ?? content;

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
  let fontMetrics: globalThis.TextMetrics & { fontSize: number };
  let scale = 1;

  if (bitmapFont) {
    const textMetrics = measureBitmapFont(bitmapFont, style.fontSize as number);
    lineHeight = textMetrics.lineHeight;
    fontMetrics = textMetrics.fontMetrics;
    scale = textMetrics.scale;
  } else {
    fontMetrics = measureFont(font);
    context.font = font;
  }

  lineHeight *= scale;

  // fallback in case UA disallow canvas data extraction
  if (fontMetrics.fontSize === 0) {
    fontMetrics.fontSize = fontSize as number;
  }

  const outputText = wordWrap
    ? wordWrapInternal(bidiChars, style, scale)
    : bidiChars;
  const lines = outputText.split(/(?:\r\n|\r|\n)/);
  const lineWidths = new Array<number>(lines.length);
  let maxLineWidth = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineWidth = measureTextInternal(
      lines[i],
      letterSpacing,
      bitmapFont,
      bitmapFontKerning,
      scale,
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

/**
 * @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L369
 */
function wordWrapInternal(text: string, style: Partial<Text>, scale: number) {
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  });

  const { letterSpacing = 0, textOverflow, maxLines, bitmapFont } = style;

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

  let ellipsis = '';
  if (textOverflow === 'ellipsis') {
    ellipsis = '...';
  } else if (textOverflow && textOverflow !== 'clip') {
    ellipsis = textOverflow;
  }

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
    );
  };
  const ellipsisWidth = Array.from(ellipsis).reduce((prev, cur) => {
    return prev + calcWidth(cur);
  }, 0);

  function appendEllipsis(lineIndex: number) {
    // If there is not enough space to display the string itself, it is clipped.
    // @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow#values
    if (ellipsisWidth <= 0 || ellipsisWidth > maxWidth) {
      return;
    }

    // Backspace from line's end.
    const currentLineLength = lines[lineIndex].length;
    let lastLineWidth = 0;
    let lastLineIndex = currentLineLength;
    for (let i = 0; i < currentLineLength; i++) {
      const width = calcWidth(lines[lineIndex][i]);
      if (lastLineWidth + width + ellipsisWidth > maxWidth) {
        lastLineIndex = i;
        break;
      }

      lastLineWidth += width;
    }

    lines[lineIndex] =
      (lines[lineIndex] || '').slice(0, lastLineIndex) + ellipsis;
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
        // parsedStyle.isOverflowing = true;

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
        // parsedStyle.isOverflowing = true;

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

      if (shouldBreakByKinsokuShorui(char, nextChar)) {
        lines = trimByKinsokuShorui(lines);
        currentWidth += calcWidth(prevChar || '');
      }
    }

    currentWidth += charWidth;
    lines[currentIndex] = (lines[currentIndex] || '') + char;
  }

  return lines.join('\n');
}

export function computeBidi(text: string) {
  if (!bidiCache[text]) {
    // @see https://github.com/beanandbean/font-mesh-pipeline/blob/main/packages/harfbuzz-modern-wrapper/src/harfbuzz.ts#L50
    const segmentStack = [new Array<TextSegment>()];

    const reduceStack = (stack: TextSegment[][], target: number) => {
      const validatedTarget = target < 0 ? 0 : target;
      while (stack.length > validatedTarget + 1) {
        const current = stack.pop()!;
        stack[stack.length - 1]!.push(...current.reverse());
      }
    };
    const pushInStack = (
      stack: TextSegment[][],
      text: string,
      level: number,
    ) => {
      if (level + 1 > stack.length) {
        stack.push(
          ...Array.from(
            { length: level + 1 - stack.length },
            () => new Array<TextSegment>(),
          ),
        );
      } else {
        reduceStack(stack, level);
      }
      stack[level]!.push({
        text,
        direction: level % 2 === 0 ? 'ltr' : 'rtl',
      });
    };

    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const iter = embeddingLevels.levels.entries();
    const first = iter.next();
    if (!first.done) {
      let [prevIndex, prevLevel] = first.value;
      for (const [i, level] of iter) {
        if (level !== prevLevel) {
          pushInStack(segmentStack, text.slice(prevIndex, i), prevLevel);
          prevIndex = i;
          prevLevel = level;
        }
      }
      pushInStack(segmentStack, text.slice(prevIndex), prevLevel);
      reduceStack(segmentStack, 0);
    }

    let bidiChars = '';
    for (const segment of segmentStack[0]!) {
      const { text, direction } = segment;

      if (direction === 'ltr') {
        bidiChars += text;
      } else {
        bidiChars += ArabicReshaper.convertArabic(text)
          .split('')
          .reverse()
          .join('');
      }
    }

    bidiCache[text] = bidiChars;
  }

  return bidiCache[text];
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
    } as globalThis.TextMetrics & { fontSize: number },
  };
}

function measureTextInternal(
  text: string,
  letterSpacing: number,
  bitmapFont: BitmapFont,
  bitmapFontKerning: boolean,
  scale: number,
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
    context.letterSpacing = `${letterSpacing}px`;

    const metrics = context.measureText(text);
    metricWidth = metrics.width;
    const actualBoundingBoxLeft = -metrics.actualBoundingBoxLeft;
    const actualBoundingBoxRight = metrics.actualBoundingBoxRight;
    boundsWidth = actualBoundingBoxRight - actualBoundingBoxLeft;
  }

  if (metricWidth > 0) {
    const val = (segments.length - 1) * letterSpacing;

    metricWidth += val;
    boundsWidth += val;
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
  context: CanvasRenderingContext2D,
  bitmapFont: BitmapFont,
  scale: number,
): number {
  let width = cache[key];
  if (typeof width !== 'number') {
    const spacing = key.length * letterSpacing;
    width =
      (bitmapFont
        ? bitmapFont.chars[key]?.xAdvance || 0
        : context.measureText(key).width) *
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
