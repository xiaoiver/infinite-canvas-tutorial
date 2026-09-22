import { loadBitmapFont } from '../../packages/ecs/src/utils/bitmap-font/load-bitmap-font';

describe('loadBitmapFont', () => {
  describe('test', () => {
    it('should return true for .xml files', () => {
      expect(loadBitmapFont.test('font.xml')).toBe(true);
      expect(loadBitmapFont.test('path/to/font.xml')).toBe(true);
    });

    it('should return true for .fnt files', () => {
      expect(loadBitmapFont.test('font.fnt')).toBe(true);
      expect(loadBitmapFont.test('path/to/font.fnt')).toBe(true);
    });

    it('should return true for uppercase extensions', () => {
      expect(loadBitmapFont.test('font.XML')).toBe(true);
      expect(loadBitmapFont.test('font.FNT')).toBe(true);
    });

    it('should return false for other file types', () => {
      expect(loadBitmapFont.test('font.png')).toBe(false);
      expect(loadBitmapFont.test('font.json')).toBe(false);
      expect(loadBitmapFont.test('font.txt')).toBe(false);
    });

    it('should return false for URLs without extension', () => {
      expect(loadBitmapFont.test('font')).toBe(false);
    });
  });

  describe('parse', () => {
    const mockImageBitmap = {
      width: 256,
      height: 256,
    };

    // Mock DOMAdapter
    beforeEach(() => {
      jest.mock('../../packages/ecs/src/environment', () => ({
        DOMAdapter: {
          get: () => ({
            createImage: jest.fn().mockResolvedValue(mockImageBitmap),
          }),
        },
      }));
    });

    it('should parse JSON format when detected', async () => {
      const jsonData = JSON.stringify({
        info: { face: 'Test', size: 24 },
        common: { lineHeight: 28, base: 22 },
        pages: [{ id: 0, file: 'test.png' }],
        chars: [],
        kernings: [],
      });

      // This would need proper mocking of DOMAdapter
      // const result = await loadBitmapFont.parse(jsonData);
      // expect(result).toBeInstanceOf(BitmapFont);
    });

    it('should parse text format when detected', async () => {
      const textData = `info face="Test" size=24
common lineHeight=28 base=22
page id=0 file="test.png"
chars count=0`;

      // This would need proper mocking of DOMAdapter
      // const result = await loadBitmapFont.parse(textData);
    });

    it('should parse XML format when detected', async () => {
      const xmlData = `<?xml version="1.0"?>
<font>
  <info face="Test" size="24"/>
  <common lineHeight="28" base="22"/>
  <pages>
    <page id="0" file="test.png"/>
  </pages>
  <chars count="0"/>
</font>`;

      // This would need proper mocking of DOMAdapter and DOMParser
      // const result = await loadBitmapFont.parse(xmlData);
    });
  });
});
