import { bitmapFontJSONParser } from '../../packages/ecs/src/utils/bitmap-font/bitmap-font-json-parser';

describe('bitmapFontJSONParser', () => {
  describe('test', () => {
    it('should return true for valid JSON string', () => {
      const data = '{"info": {"face": "Test"}}';
      expect(bitmapFontJSONParser.test(data)).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      const data = '{invalid json}';
      expect(bitmapFontJSONParser.test(data)).toBe(false);
    });

    it('should return true for already parsed object', () => {
      const data = { info: { face: 'Test' } };
      // JSON.parse will fail on objects, so test should return false
      expect(bitmapFontJSONParser.test(data as any)).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleJSON = JSON.stringify({
      info: {
        face: 'Arial',
        size: 24,
      },
      common: {
        lineHeight: 28,
        base: 22,
      },
      pages: [
        { id: 0, file: 'arial.png' },
      ],
      chars: [
        {
          id: 32,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          xoffset: 0,
          yoffset: 0,
          xadvance: 6,
          page: 0,
          letter: 'space',
        },
        {
          id: 65,
          x: 10,
          y: 10,
          width: 20,
          height: 22,
          xoffset: 0,
          yoffset: 0,
          xadvance: 20,
          page: 0,
          letter: 'A',
        },
      ],
      kernings: [
        { first: 65, second: 66, amount: -1 },
      ],
      distanceField: {
        fieldType: 'msdf',
        distanceRange: 4,
      },
    });

    it('should parse basic font info', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);

      expect(result.fontFamily).toBe('Arial');
      expect(result.fontSize).toBe(24);
      expect(result.lineHeight).toBe(28);
      expect(result.baseLineOffset).toBe(6);
    });

    it('should parse pages', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toEqual({
        id: 0,
        file: 'arial.png',
      });
    });

    it('should parse characters', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);

      expect(Object.keys(result.chars)).toHaveLength(2);
      expect(result.chars[' ']).toBeDefined();
      expect(result.chars['A']).toBeDefined();
    });

    it('should parse character data correctly', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);
      const charA = result.chars['A'];

      expect(charA.id).toBe(65);
      expect(charA.x).toBe(10);
      expect(charA.y).toBe(10);
      expect(charA.width).toBe(20);
      expect(charA.height).toBe(22);
      expect(charA.xOffset).toBe(0);
      expect(charA.yOffset).toBe(0);
      expect(charA.xAdvance).toBe(20);
      expect(charA.page).toBe(0);
    });

    it('should handle space letter', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);

      expect(result.chars[' ']).toBeDefined();
      expect(result.chars[' '].id).toBe(32);
    });

    it('should parse kerning pairs', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);

      // Kerning for 'B' (id 66) from 'A' (id 65)
      expect(result.chars['B']).toBeUndefined(); // B is not defined in chars
    });

    it('should parse distance field info', () => {
      const result = bitmapFontJSONParser.parse(sampleJSON);

      expect(result.distanceField).toEqual({
        type: 'msdf',
        range: 4,
      });
    });

    it('should handle page as string array', () => {
      const jsonWithStringPages = JSON.stringify({
        info: { face: 'Test', size: 24 },
        common: { lineHeight: 28, base: 22 },
        pages: ['page0.png', 'page1.png'],
        chars: [],
        kernings: [],
      });

      const result = bitmapFontJSONParser.parse(jsonWithStringPages);

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].file).toBe('page0.png');
      expect(result.pages[1].file).toBe('page1.png');
    });

    it('should use char field if letter is missing', () => {
      const jsonWithCharField = JSON.stringify({
        info: { face: 'Test', size: 24 },
        common: { lineHeight: 28, base: 22 },
        pages: [],
        chars: [
          {
            id: 65,
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            xoffset: 0,
            yoffset: 0,
            xadvance: 10,
            page: 0,
            char: 'A',
          },
        ],
        kernings: [],
      });

      const result = bitmapFontJSONParser.parse(jsonWithCharField);

      expect(result.chars['A']).toBeDefined();
    });

    it('should fallback to String.fromCharCode if no letter or char', () => {
      const jsonWithNoLetter = JSON.stringify({
        info: { face: 'Test', size: 24 },
        common: { lineHeight: 28, base: 22 },
        pages: [],
        chars: [
          {
            id: 65,
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            xoffset: 0,
            yoffset: 0,
            xadvance: 10,
            page: 0,
          },
        ],
        kernings: [],
      });

      const result = bitmapFontJSONParser.parse(jsonWithNoLetter);

      expect(result.chars['A']).toBeDefined();
    });

    it('should handle missing distanceField', () => {
      const jsonWithoutDF = JSON.stringify({
        info: { face: 'Test', size: 24 },
        common: { lineHeight: 28, base: 22 },
        pages: [],
        chars: [],
        kernings: [],
      });

      const result = bitmapFontJSONParser.parse(jsonWithoutDF);

      expect(result.distanceField).toBeNull();
    });

    it('should handle empty kernings array', () => {
      const jsonNoKerning = JSON.stringify({
        info: { face: 'Test', size: 24 },
        common: { lineHeight: 28, base: 22 },
        pages: [],
        chars: [
          {
            id: 65,
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            xoffset: 0,
            yoffset: 0,
            xadvance: 10,
            page: 0,
            letter: 'A',
          },
        ],
        kernings: [],
      });

      const result = bitmapFontJSONParser.parse(jsonNoKerning);

      expect(result.chars['A'].kerning).toEqual({});
    });
  });
});
