import { bitmapFontTextParser } from '../../packages/ecs/src/utils/bitmap-font/bitmap-font-text-parser';

describe('bitmapFontTextParser', () => {
  describe('test', () => {
    it('should return true for valid text format', () => {
      const data = 'info face="Test" size=24';
      expect(bitmapFontTextParser.test(data)).toBe(true);
    });

    it('should return false for non-string data', () => {
      expect(bitmapFontTextParser.test(123 as any)).toBe(false);
      expect(bitmapFontTextParser.test({} as any)).toBe(false);
      expect(bitmapFontTextParser.test(null as any)).toBe(false);
    });

    it('should return false for XML string', () => {
      const data = '<font><info face="Test"/></font>';
      expect(bitmapFontTextParser.test(data)).toBe(false);
    });

    it('should return false for JSON string', () => {
      const data = '{"info": {"face": "Test"}}';
      expect(bitmapFontTextParser.test(data)).toBe(false);
    });
  });

  describe('parse', () => {
    const sampleText = `info face="Arial" size=24 bold=0 italic=0 charset="" unicode=0 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=2,2
common lineHeight=28 base=22 scaleW=256 scaleH=256 pages=1 packed=0
page id=0 file="arial.png"
chars count=3
char id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=6 page=0 chnl=0 letter="space"
char id=65 x=10 y=10 width=20 height=22 xoffset=0 yoffset=0 xadvance=20 page=0 chnl=0 letter="A"
char id=66 x=40 y=10 width=18 height=22 xoffset=0 yoffset=0 xadvance=18 page=0 chnl=0 letter="B"
kernings count=1
kerning first=65 second=66 amount=-1`;

    it('should parse basic font info', () => {
      const result = bitmapFontTextParser.parse(sampleText);

      expect(result.fontFamily).toBe('Arial');
      expect(result.fontSize).toBe(24);
      expect(result.lineHeight).toBe(28);
      expect(result.baseLineOffset).toBe(6); // lineHeight - base = 28 - 22
    });

    it('should parse pages', () => {
      const result = bitmapFontTextParser.parse(sampleText);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toEqual({
        id: 0,
        file: 'arial.png',
      });
    });

    it('should parse characters', () => {
      const result = bitmapFontTextParser.parse(sampleText);

      expect(Object.keys(result.chars)).toHaveLength(3);
      expect(result.chars[' ']).toBeDefined();
      expect(result.chars['A']).toBeDefined();
      expect(result.chars['B']).toBeDefined();
    });

    it('should parse character data correctly', () => {
      const result = bitmapFontTextParser.parse(sampleText);
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

    it('should parse kerning pairs', () => {
      const result = bitmapFontTextParser.parse(sampleText);
      const charB = result.chars['B'];

      expect(charB.kerning).toBeDefined();
      expect(charB.kerning['A']).toBe(-1);
    });

    it('should handle "space" letter conversion', () => {
      const result = bitmapFontTextParser.parse(sampleText);

      expect(result.chars[' ']).toBeDefined();
      expect(result.chars[' '].id).toBe(32);
    });

    it('should handle multiple pages', () => {
      const multiPageText = `info face="Test" size=24
common lineHeight=28 base=22 scaleW=256 scaleH=256 pages=2
page id=0 file="page0.png"
page id=1 file="page1.png"
chars count=0`;

      const result = bitmapFontTextParser.parse(multiPageText);

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].file).toBe('page0.png');
      expect(result.pages[1].file).toBe('page1.png');
    });

    it('should handle empty kerning', () => {
      const noKerningText = `info face="Test" size=24
common lineHeight=28 base=22
page id=0 file="test.png"
chars count=1
char id=65 x=0 y=0 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0`;

      const result = bitmapFontTextParser.parse(noKerningText);

      expect(result.chars['A'].kerning).toEqual({});
    });

    it('should parse distance field info', () => {
      const sdfText = `info face="Test" size=24
common lineHeight=28 base=22
page id=0 file="test.png"
distanceField fieldType="sdf" distanceRange="4"
chars count=0`;

      const result = bitmapFontTextParser.parse(sdfText);

      expect(result.distanceField).toEqual({
        type: 'sdf',
        range: 4,
      });
    });

    it('should handle missing optional fields', () => {
      const minimalText = `info face="Test" size=24
common lineHeight=28 base=22
page id=0 file="test.png"
chars count=1
char id=65 x=0 y=0 width=10 height=10 xoffset=0 yoffset=0 xadvance=10 page=0`;

      const result = bitmapFontTextParser.parse(minimalText);

      expect(result.fontFamily).toBe('Test');
      expect(result.fontSize).toBe(24);
      expect(result.distanceField).toBeNull();
    });
  });
});
