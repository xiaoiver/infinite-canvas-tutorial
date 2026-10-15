import {
  DOMAdapter,
  fontStringFromTextStyle,
  measureText,
} from '../../packages/ecs/src';
import type { BitmapFont } from '../../packages/ecs/src/utils/bitmap-font/BitmapFont';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

const bitmapFont = {
  baseMeasurementFontSize: 20,
  lineHeight: 24,
  fontMetrics: { ascent: 15, descent: 5 },
  chars: {
    A: { xAdvance: 10, kerning: {} },
    B: { xAdvance: 12, kerning: { A: -2 } },
    C: { xAdvance: 10, kerning: {} },
    ' ': { xAdvance: 5, kerning: {} },
    中: { xAdvance: 10, kerning: {} },
    '。': { xAdvance: 10, kerning: {} },
    '👩‍💻': { xAdvance: 30, kerning: {} },
    '.': { xAdvance: 4, kerning: {} },
  },
} as unknown as BitmapFont;

const textStyle = {
  fontFamily: 'sans-serif',
  fontSize: 20,
};

it('quotes font family arrays without changing the supplied style', () => {
  const fontFamily = ['Open Sans', 'serif'];

  expect(
    fontStringFromTextStyle({ fontFamily, fontSize: 16, fontWeight: 'bold' }),
  ).toBe('normal normal 700 16px "Open Sans",serif');
  expect(fontFamily).toEqual(['Open Sans', 'serif']);
  expect(fontStringFromTextStyle({ fontSize: 16 })).toBe(
    'normal normal normal 16px sans-serif',
  );
});

it.each([
  ['👩‍💻', '👩‍💻 ABC DEF GHI'],
  ['e\u0301', 'e\u0301e\u0301 ABC DEF GHI'],
])('truncates %s without leaving part of a grapheme', (grapheme, content) => {
  const truncated: string[] = [];
  for (let wordWrapWidth = 60; wordWrapWidth <= 240; wordWrapWidth += 20) {
    const line = measureText({
      ...textStyle,
      content,
      wordWrap: true,
      wordWrapWidth,
      maxLines: 1,
    }).lines?.[0];
    if (!line?.endsWith('...')) continue;
    truncated.push(line);
    const prefix = line.slice(0, -3);
    if (grapheme === '👩‍💻') {
      expect(prefix.replaceAll(grapheme, '')).not.toMatch(/👩|💻|\u200d/);
      expect(prefix).not.toMatch(
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
      );
    } else {
      expect(prefix.replaceAll(grapheme, '')).not.toMatch(/e|\u0301/);
    }
  }

  expect(truncated.length).toBeGreaterThan(0);
  expect(truncated.some((line) => line.startsWith(grapheme))).toBe(true);
});

it('keeps custom overflow markers and supports clipping without a marker', () => {
  const style = {
    ...textStyle,
    content: 'Hello world, with more text',
    wordWrap: true,
    wordWrapWidth: 80,
    maxLines: 1,
  };

  expect(measureText({ ...style, textOverflow: '…' }).lines?.[0]).toMatch(/…$/);
  expect(
    measureText({ ...style, textOverflow: 'clip' }).lines?.[0],
  ).not.toContain('…');
});

it('positions two measured lines using alignment, baseline and leading', () => {
  const computed = measureText({
    ...textStyle,
    content: 'Wide\ni',
    lineHeight: 24,
    leading: 4,
    textAlign: 'center',
    textBaseline: 'middle',
  });

  expect(computed.lines).toEqual(['Wide', 'i']);
  expect(computed.lineMetrics?.[0].x).toBeCloseTo(-computed.lineWidths![0] / 2);
  expect(computed.lineMetrics?.[0].y).toBeCloseTo(-computed.height! / 2);
  expect(computed.lineMetrics?.[1].y).toBeCloseTo(
    computed.lineMetrics![0].y + computed.lineHeight!,
  );
  expect(computed.lineHeight).toBe(28);
});

it('scales bitmap advances, kerning and line height once', () => {
  const style = {
    ...textStyle,
    content: 'AB',
    fontSize: 40,
    bitmapFont,
  };

  const kerned = measureText({ ...style, bitmapFontKerning: true });
  const plain = measureText({ ...style, bitmapFontKerning: false });

  expect(kerned.lineWidths).toEqual([40]);
  expect(plain.lineWidths).toEqual([44]);
  expect(kerned.lineHeight).toBe(48);
});

it('wraps bitmap glyphs on grapheme boundaries', () => {
  const computed = measureText({
    ...textStyle,
    content: 'A👩‍💻B',
    bitmapFont,
    wordWrap: true,
    wordWrapWidth: 25,
  });

  expect(computed.lines).toEqual(['A', '👩‍💻', 'B']);
  expect(computed.lineWidths).toEqual([10, 30, 12]);
});

it('counts letter spacing once per bitmap grapheme when wrapping', () => {
  const computed = measureText({
    ...textStyle,
    content: '👩‍💻A',
    bitmapFont,
    wordWrap: true,
    wordWrapWidth: 45,
    letterSpacing: 5,
  });

  expect(computed.lines).toEqual(['👩‍💻A']);
});

it('moves a trailing Latin word after a bitmap space without splitting emoji', () => {
  const computed = measureText({
    ...textStyle,
    content: '👩‍💻 BC',
    bitmapFont,
    wordWrap: true,
    wordWrapWidth: 47,
  });

  expect(computed.lines).toEqual(['👩‍💻', 'BC']);
});

it('moves a whole emoji before punctuation that cannot start a CJK line', () => {
  const computed = measureText({
    ...textStyle,
    content: '中👩‍💻。B',
    bitmapFont,
    wordWrap: true,
    wordWrapWidth: 40,
  });

  expect(computed.lines).toEqual(['中', '👩‍💻。', 'B']);
});
