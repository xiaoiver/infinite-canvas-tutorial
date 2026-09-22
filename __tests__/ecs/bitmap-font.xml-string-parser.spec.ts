import { bitmapFontXMLStringParser } from '../../packages/ecs/src/utils/bitmap-font/bitmap-font-xml-string-parser';
import { DOMAdapter } from '../../packages/ecs/src/environment';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('bitmapFontXMLStringParser', () => {
  describe('test', () => {
    it('should return true for valid XML string with font tag', () => {
      const xmlString = '<?xml version="1.0"?><font><info face="Test" size="24"/></font>';
      expect(bitmapFontXMLStringParser.test(xmlString)).toBe(false);
    });

    it('should return false for non-XML string', () => {
      expect(bitmapFontXMLStringParser.test('not xml')).toBe(false);
      expect(bitmapFontXMLStringParser.test('info face="Test"')).toBe(false);
      expect(bitmapFontXMLStringParser.test('{"info": "test"}')).toBe(false);
    });

    it('should return false for string without font tag', () => {
      const xmlString = '<?xml version="1.0"?><other><info face="Test"/></other>';
      expect(bitmapFontXMLStringParser.test(xmlString)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(bitmapFontXMLStringParser.test('')).toBe(false);
    });

    it('should return false for non-string data', () => {
      expect(bitmapFontXMLStringParser.test(123 as any)).toBe(false);
      expect(bitmapFontXMLStringParser.test(null as any)).toBe(false);
      expect(bitmapFontXMLStringParser.test({} as any)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse XML string to BitmapFontData', () => {
      const xmlString = `<?xml version="1.0"?>
<font>
  <info face="Arial" size="24"/>
  <common lineHeight="28" base="22"/>
  <pages>
    <page id="0" file="arial.png"/>
  </pages>
  <chars count="1">
    <char id="65" x="10" y="10" width="20" height="22" xoffset="0" yoffset="0" xadvance="20" page="0" letter="A"/>
  </chars>
</font>`;

      const result = bitmapFontXMLStringParser.parse(xmlString);

      expect(result.fontFamily).toBe('Arial');
      expect(result.fontSize).toBe(24);
      expect(result.lineHeight).toBe(28);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].file).toBe('arial.png');
      expect(result.chars['A']).toBeDefined();
    });

    it('should parse XML string with SDF info', () => {
      const xmlString = `<?xml version="1.0"?>
<font>
  <info face="SDFFont" size="32"/>
  <common lineHeight="36" base="28"/>
  <distanceField fieldType="msdf" distanceRange="4"/>
  <pages>
    <page id="0" file="sdf.png"/>
  </pages>
  <chars count="0"/>
</font>`;

      const result = bitmapFontXMLStringParser.parse(xmlString);

      expect(result.fontFamily).toBe('SDFFont');
      expect(result.distanceField).toEqual({ type: 'msdf', range: 4 });
    });

    it('should handle XML with kerning pairs', () => {
      const xmlString = `<?xml version="1.0"?>
<font>
  <info face="Test" size="24"/>
  <common lineHeight="28" base="22"/>
  <pages>
    <page id="0" file="test.png"/>
  </pages>
  <chars count="2">
    <char id="65" x="0" y="0" width="10" height="10" xoffset="0" yoffset="0" xadvance="10" page="0" letter="A"/>
    <char id="66" x="10" y="0" width="10" height="10" xoffset="0" yoffset="0" xadvance="10" page="0" letter="B"/>
  </chars>
  <kernings count="1">
    <kerning first="65" second="66" amount="-1"/>
  </kernings>
</font>`;

      const result = bitmapFontXMLStringParser.parse(xmlString);

      expect(result.chars['A']).toBeDefined();
      expect(result.chars['B']).toBeDefined();
      expect(result.chars['B'].kerning['A']).toBe(-1);
    });
  });
});
