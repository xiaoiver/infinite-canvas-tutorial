import bidiFactory from 'bidi-js';
import ArabicReshaper from 'arabic-reshaper';
import { DOMAdapter } from '../environment/adapter';

const bidi = bidiFactory();
const cache = new Map<string, string>();

// bidi-js 1.0.3 indexes UTF-16 units internally. Supply one BMP character of
// the same bidi class per Unicode scalar, keeping a separate glyph mapping.
// BMP characters (including paired brackets and isolates) remain unchanged.
const representatives: Record<string, string> = {
  L: 'A',
  R: '\u05d0',
  AL: '\u0627',
  EN: '0',
  ES: '+',
  ET: '$',
  AN: '\u0660',
  CS: ',',
  NSM: '\u0300',
  BN: '\u200b',
  B: '\n',
  S: '\t',
  WS: ' ',
  ON: '\ufffc',
};

export function needsBidiGlyphLayout(text: string): boolean {
  for (const char of text) {
    const type = bidi.getBidiCharTypeName(char);
    if (
      type === 'R' ||
      type === 'AL' ||
      /[\u202a-\u202e\u2066-\u2069]/.test(char)
    )
      return true;
  }
  return false;
}

function reorderParagraph(text: string): string {
  // Shape in logical order so lam-alef ligatures still form correctly.
  const shaped: string = ArabicReshaper.convertArabic(text);
  const chars = Array.from(shaped);
  const analysis = chars
    .map((char) =>
      char.length === 1
        ? char
        : representatives[bidi.getBidiCharTypeName(char)] ?? '\ufffc',
    )
    .join('');
  const embedding = bidi.getEmbeddingLevels(analysis);
  const glyphs: string[] = [];
  const glyphAt: number[] = [];
  let index = 0;
  for (const grapheme of DOMAdapter.get().splitGraphemes(shaped)) {
    const glyph = Array.from(grapheme)
      .map((char) => {
        glyphAt.push(glyphs.length);
        const level = embedding.levels[index++];
        return (level & 1 ? bidi.getMirroredCharacter(char) : null) ?? char;
      })
      .join('');
    glyphs.push(glyph);
  }

  // UAX #9 L2 reorders scalars; emit each grapheme once (L3), preserving
  // combining marks, surrogate pairs, ZWJ emoji and skin-tone modifiers.
  const seen = new Set<number>();
  return bidi
    .getReorderedIndices(analysis, embedding)
    .map((i: number) => {
      const glyph = glyphAt[i];
      if (seen.has(glyph)) return '';
      seen.add(glyph);
      return glyphs[glyph];
    })
    .join('');
}

/** Visual glyph order for the atlas only; document/editor text stays logical. */
export function computeBidiForGlyphAtlas(text: string): string {
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  // Hard paragraph breaks must never be reversed with an adjacent RTL run.
  const result = text
    .split(/(\r\n|\r|\n)/)
    .map((part, i) => (i % 2 ? part : reorderParagraph(part)))
    .join('');
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(text, result);
  return result;
}
