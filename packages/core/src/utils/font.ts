import bidiFactory from 'bidi-js';
import { Rectangle } from '@pixi/math';
import { TextAttributes, TextStyleWhiteSpace } from '../shapes';
import { createOffscreenCanvas } from './browser';

type FontProperties = {
  ascent: number;
  descent: number;
  fontSize: number;
};
type CharacterWidthCache = Record<string, number>;
type TextMetrics = {
  font: string;
  width: number;
  height: number;
  lines: string[];
  lineWidths: number[];
  lineHeight: number;
  maxLineWidth: number;
  fontProperties: FontProperties;
  lineMetrics: Rectangle[];
};
// type TextSegment = { text: string; direction: 'ltr' | 'rtl' };

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

export class CanvasTextMetrics {
  #fonts: Record<string, FontProperties>;
  #canvas: OffscreenCanvas | HTMLCanvasElement;
  #context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  #bidi = bidiFactory();

  constructor() {
    const canvas = createOffscreenCanvas();
    if (canvas) {
      this.#canvas = canvas;
      this.#context = canvas.getContext('2d') as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D;
    }
  }

  measureText(text: string, style: Partial<TextAttributes>): TextMetrics {
    const {
      wordWrap,
      letterSpacing,
      textAlign,
      textBaseline,
      strokeWidth,
      leading,
    } = style;
    let { lineHeight } = style;
    const font = fontStringFromTextStyle(style);
    const fontProperties = this.measureFont(font);
    // fallback in case UA disallow canvas data extraction
    if (fontProperties.fontSize === 0) {
      fontProperties.fontSize = style.fontSize as number;
      fontProperties.ascent = style.fontSize as number;
    }

    this.#context.font = font;

    const outputText = wordWrap ? this.wordWrap(text, style) : text;
    const lines = outputText.split(/(?:\r\n|\r|\n)/);
    const lineWidths = new Array<number>(lines.length);
    let maxLineWidth = 0;
    for (let i = 0; i < lines.length; i++) {
      // char width + letterSpacing
      const lineWidth =
        this.#context.measureText(lines[i]).width +
        (lines[i].length - 1) * letterSpacing;
      lineWidths[i] = lineWidth;
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    }
    const width = maxLineWidth + strokeWidth;
    lineHeight = lineHeight || fontProperties.fontSize + strokeWidth;
    const height =
      Math.max(lineHeight, fontProperties.fontSize + strokeWidth) +
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
      fontProperties,
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

    // const segmentStack = [new Array<TextSegment>()];

    // const reduceStack = (stack: TextSegment[][], target: number) => {
    //   const validatedTarget = target < 0 ? 0 : target;
    //   while (stack.length > validatedTarget + 1) {
    //     const current = stack.pop()!;
    //     stack[stack.length - 1]!.push(...current.reverse());
    //   }
    // };
    // const pushInStack = (
    //   stack: TextSegment[][],
    //   text: string,
    //   level: number,
    // ) => {
    //   if (level + 1 > stack.length) {
    //     stack.push(
    //       ...Array.from(
    //         { length: level + 1 - stack.length },
    //         () => new Array<TextSegment>(),
    //       ),
    //     );
    //   } else {
    //     reduceStack(stack, level);
    //   }
    //   stack[level]!.push({ text, direction: level % 2 === 0 ? 'ltr' : 'rtl' });
    // };

    // const embeddingLevels = bidi.getEmbeddingLevels(text);
    // const iter = embeddingLevels.levels.entries();
    // const first = iter.next();
    // if (!first.done) {
    //   let [prevIndex, prevLevel] = first.value;
    //   for (const [i, level] of iter) {
    //     if (level !== prevLevel) {
    //       pushInStack(segmentStack, text.slice(prevIndex, i), prevLevel);
    //       prevIndex = i;
    //       prevLevel = level;
    //     }
    //   }
    //   pushInStack(segmentStack, text.slice(prevIndex), prevLevel);
    //   reduceStack(segmentStack, 0);
    // }

    // const base = { x: 0, y: 0 };
    // const glyphs = new Array<{
    //   id: number;
    //   base: { x: number; y: number };
    // }>();
    // for (const segment of segmentStack[0]!) {
    // }
  }

  measureFont(font: string) {
    if (this.#fonts[font]) {
      return this.#fonts[font];
    }

    this.#context.font = font;
    const metrics = this.#context.measureText(METRICS_STRING + BASELINE_SYMBOL);

    const properties: FontProperties = {
      ascent: metrics.actualBoundingBoxAscent,
      descent: metrics.actualBoundingBoxDescent,
      fontSize:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
    };

    this.#fonts[font] = properties;

    return properties;
  }

  /**
   * @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/CanvasTextMetrics.ts#L369
   */
  wordWrap(text: string, style: Partial<TextAttributes>) {
    const context = this.#canvas.getContext('2d', {
      willReadFrequently: true,
    });

    const { letterSpacing, textOverflow, maxLines } = style;

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
      return this.getFromCache(
        char,
        letterSpacing,
        cache,
        context as CanvasRenderingContext2D,
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

      if (this.isNewline(char)) {
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

        if (this.isBreakingSpace(char)) {
          continue;
        }

        if (!this.canBreakInLastChar(char)) {
          lines = this.trimToBreakable(lines);
          currentWidth = this.sumTextWidthByCache(
            lines[currentIndex] || '',
            cache,
          );
        }

        if (this.shouldBreakByKinsokuShorui(char, nextChar)) {
          lines = this.trimByKinsokuShorui(lines);
          currentWidth += calcWidth(prevChar || '');
        }
      }

      currentWidth += charWidth;
      lines[currentIndex] = (lines[currentIndex] || '') + char;
    }

    return lines.join('\n');
  }

  private collapseSpaces(whiteSpace: TextStyleWhiteSpace) {
    return whiteSpace === 'normal' || whiteSpace === 'pre-line';
  }

  private collapseNewlines(whiteSpace: TextStyleWhiteSpace) {
    return whiteSpace === 'normal';
  }

  private isBreakingSpace(char: string): boolean {
    return BREAKING_SPACES.includes(char.charCodeAt(0));
  }

  private isNewline(char: string): boolean {
    return NEWLINES.includes(char.charCodeAt(0));
  }

  private trimToBreakable(prev: string[]): string[] {
    const next = [...prev];
    const prevLine = next[next.length - 2];

    const index = this.findBreakableIndex(prevLine);
    if (index === -1 || !prevLine) return next;

    const trimmedChar = prevLine.slice(index, index + 1);
    const isTrimmedWithSpace = this.isBreakingSpace(trimmedChar);

    const trimFrom = index + 1;
    const trimTo = index + (isTrimmedWithSpace ? 0 : 1);
    next[next.length - 1] += prevLine.slice(trimFrom, prevLine.length);
    next[next.length - 2] = prevLine.slice(0, trimTo);

    return next;
  }

  private shouldBreakByKinsokuShorui = (
    char: string | undefined,
    nextChar: string,
  ): boolean => {
    if (this.isBreakingSpace(nextChar)) return false;

    if (char) {
      // Line breaking rules in CJK (Kinsoku Shori)
      if (regexCannotEnd.exec(nextChar) || regexCannotStart.exec(char)) {
        return true;
      }
    }
    return false;
  };

  private trimByKinsokuShorui = (prev: string[]): string[] => {
    const next = [...prev];
    const prevLine = next[next.length - 2];
    if (!prevLine) {
      return prev;
    }

    const lastChar = prevLine[prevLine.length - 1];

    next[next.length - 2] = prevLine.slice(0, -1);
    next[next.length - 1] = lastChar + next[next.length - 1];
    return next;
  };

  private canBreakInLastChar(char: string | undefined): boolean {
    if (char && LATIN_REGEX.test(char)) return false;
    return true;
  }

  private sumTextWidthByCache(
    text: string,
    cache: { [key in string]: number },
  ) {
    return text.split('').reduce((sum: number, c) => {
      if (!cache[c]) throw Error('cannot count the word without cache');
      return sum + cache[c];
    }, 0);
  }

  private findBreakableIndex(line: string): number {
    for (let i = line.length - 1; i >= 0; i--) {
      if (!LATIN_REGEX.test(line[i])) return i;
    }
    return -1;
  }

  private getFromCache(
    key: string,
    letterSpacing: number,
    cache: CharacterWidthCache,
    context: CanvasRenderingContext2D,
  ): number {
    let width = cache[key];
    if (typeof width !== 'number') {
      const spacing = key.length * letterSpacing;
      width = context.measureText(key).width + spacing;
      cache[key] = width;
    }
    return width;
  }
}

// @see https://github.com/pixijs/pixijs/blob/dev/src/scene/text/canvas/utils/fontStringFromTextStyle.ts#L17
const genericFontFamilies = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
];

/**
 * Generates a font style string to use for `TextMetrics.measureFont()`.
 * @param style
 * @returns Font style string, for passing to `TextMetrics.measureFont()`
 */
export function fontStringFromTextStyle(
  style: Partial<TextAttributes>,
): string {
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
  return `${style.fontStyle} ${style.fontVariant} ${
    style.fontWeight
  } ${fontSizeString} ${(fontFamilies as string[]).join(',')}`;
}
