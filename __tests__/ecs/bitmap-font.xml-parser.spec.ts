import { JSDOM } from 'jsdom';
import { bitmapFontXMLParser } from '../../packages/ecs/src/utils/bitmap-font/bitmap-font-xml-parser';

const { window } = new JSDOM();
const { document } = window;

describe('bitmapFontXMLParser', () => {
  describe('test', () => {
    it('should return true for valid XML document', () => {
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');
      const page = xml.createElement('page');
      page.setAttribute('id', '0');
      page.setAttribute('file', 'test.png');
      const info = xml.createElement('info');
      info.setAttribute('face', 'Test');
      info.setAttribute('size', '24');
      font.appendChild(page);
      font.appendChild(info);
      xml.appendChild(font);

      expect(bitmapFontXMLParser.test(xml)).toBe(true);
    });

    it('should return false for string data', () => {
      expect(bitmapFontXMLParser.test('<font></font>')).toBe(false);
    });

    it('should return false for XML without page elements', () => {
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');
      const info = xml.createElement('info');
      info.setAttribute('face', 'Test');
      font.appendChild(info);
      xml.appendChild(font);

      expect(bitmapFontXMLParser.test(xml)).toBe(false);
    });

    it('should return false for XML without info face attribute', () => {
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');
      const page = xml.createElement('page');
      const info = xml.createElement('info');
      font.appendChild(page);
      font.appendChild(info);
      xml.appendChild(font);

      expect(bitmapFontXMLParser.test(xml)).toBe(false);
    });
  });

  describe('parse', () => {
    const createSampleXML = (): Document => {
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');

      const info = xml.createElement('info');
      info.setAttribute('face', 'Arial');
      info.setAttribute('size', '24');
      font.appendChild(info);

      const common = xml.createElement('common');
      common.setAttribute('lineHeight', '28');
      common.setAttribute('base', '22');
      font.appendChild(common);

      const pages = xml.createElement('pages');
      const page = xml.createElement('page');
      page.setAttribute('id', '0');
      page.setAttribute('file', 'arial.png');
      pages.appendChild(page);
      font.appendChild(pages);

      const chars = xml.createElement('chars');
      chars.setAttribute('count', '2');

      const charA = xml.createElement('char');
      charA.setAttribute('id', '65');
      charA.setAttribute('x', '10');
      charA.setAttribute('y', '10');
      charA.setAttribute('width', '20');
      charA.setAttribute('height', '22');
      charA.setAttribute('xoffset', '0');
      charA.setAttribute('yoffset', '0');
      charA.setAttribute('xadvance', '20');
      charA.setAttribute('page', '0');
      charA.setAttribute('letter', 'A');
      chars.appendChild(charA);

      const charB = xml.createElement('char');
      charB.setAttribute('id', '66');
      charB.setAttribute('x', '40');
      charB.setAttribute('y', '10');
      charB.setAttribute('width', '18');
      charB.setAttribute('height', '22');
      charB.setAttribute('xoffset', '1');
      charB.setAttribute('yoffset', '2');
      charB.setAttribute('xadvance', '19');
      charB.setAttribute('page', '0');
      charB.setAttribute('letter', 'B');
      chars.appendChild(charB);

      font.appendChild(chars);

      const kernings = xml.createElement('kernings');
      const kerning = xml.createElement('kerning');
      kerning.setAttribute('first', '65');
      kerning.setAttribute('second', '66');
      kerning.setAttribute('amount', '-1');
      kernings.appendChild(kerning);
      font.appendChild(kernings);

      xml.appendChild(font);
      return xml;
    };

    it('should parse basic font info', () => {
      const xml = createSampleXML();
      const result = bitmapFontXMLParser.parse(xml);

      expect(result.fontFamily).toBe('Arial');
      expect(result.fontSize).toBe(24);
      expect(result.lineHeight).toBe(28);
      expect(result.baseLineOffset).toBe(6);
    });

    it('should parse pages', () => {
      const xml = createSampleXML();
      const result = bitmapFontXMLParser.parse(xml);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]).toEqual({ id: 0, file: 'arial.png' });
    });

    it('should parse characters', () => {
      const xml = createSampleXML();
      const result = bitmapFontXMLParser.parse(xml);

      expect(Object.keys(result.chars)).toHaveLength(2);
      expect(result.chars['A']).toBeDefined();
      expect(result.chars['B']).toBeDefined();
    });

    it('should parse character data correctly', () => {
      const xml = createSampleXML();
      const result = bitmapFontXMLParser.parse(xml);
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
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');

      const info = xml.createElement('info');
      info.setAttribute('face', 'Test');
      info.setAttribute('size', '24');
      font.appendChild(info);

      const common = xml.createElement('common');
      common.setAttribute('lineHeight', '28');
      common.setAttribute('base', '22');
      font.appendChild(common);

      const pages = xml.createElement('pages');
      const page = xml.createElement('page');
      page.setAttribute('id', '0');
      page.setAttribute('file', 'test.png');
      pages.appendChild(page);
      font.appendChild(pages);

      const chars = xml.createElement('chars');
      const charSpace = xml.createElement('char');
      charSpace.setAttribute('id', '32');
      charSpace.setAttribute('x', '0');
      charSpace.setAttribute('y', '0');
      charSpace.setAttribute('width', '0');
      charSpace.setAttribute('height', '0');
      charSpace.setAttribute('xoffset', '0');
      charSpace.setAttribute('yoffset', '0');
      charSpace.setAttribute('xadvance', '6');
      charSpace.setAttribute('page', '0');
      charSpace.setAttribute('letter', 'space');
      chars.appendChild(charSpace);
      font.appendChild(chars);

      xml.appendChild(font);

      const result = bitmapFontXMLParser.parse(xml);
      expect(result.chars[' ']).toBeDefined();
      expect(result.chars[' '].id).toBe(32);
    });

    it('should parse distance field info', () => {
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');

      const info = xml.createElement('info');
      info.setAttribute('face', 'Test');
      info.setAttribute('size', '24');
      font.appendChild(info);

      const common = xml.createElement('common');
      common.setAttribute('lineHeight', '28');
      common.setAttribute('base', '22');
      font.appendChild(common);

      const df = xml.createElement('distanceField');
      df.setAttribute('fieldType', 'msdf');
      df.setAttribute('distanceRange', '4');
      font.appendChild(df);

      const pages = xml.createElement('pages');
      const page = xml.createElement('page');
      page.setAttribute('id', '0');
      page.setAttribute('file', 'test.png');
      pages.appendChild(page);
      font.appendChild(pages);

      const chars = xml.createElement('chars');
      font.appendChild(chars);

      xml.appendChild(font);

      const result = bitmapFontXMLParser.parse(xml);
      expect(result.distanceField).toEqual({ type: 'msdf', range: 4 });
    });

    it('should handle multiple pages', () => {
      const xml = document.implementation.createDocument('', '', null);
      const font = xml.createElement('font');

      const info = xml.createElement('info');
      info.setAttribute('face', 'Test');
      info.setAttribute('size', '24');
      font.appendChild(info);

      const common = xml.createElement('common');
      common.setAttribute('lineHeight', '28');
      common.setAttribute('base', '22');
      font.appendChild(common);

      const pages = xml.createElement('pages');
      const page0 = xml.createElement('page');
      page0.setAttribute('id', '0');
      page0.setAttribute('file', 'page0.png');
      pages.appendChild(page0);
      const page1 = xml.createElement('page');
      page1.setAttribute('id', '1');
      page1.setAttribute('file', 'page1.png');
      pages.appendChild(page1);
      font.appendChild(pages);

      const chars = xml.createElement('chars');
      font.appendChild(chars);

      xml.appendChild(font);

      const result = bitmapFontXMLParser.parse(xml);
      expect(result.pages).toHaveLength(2);
    });
  });
});
