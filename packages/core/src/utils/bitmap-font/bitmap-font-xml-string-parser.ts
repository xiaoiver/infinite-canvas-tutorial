import { BitmapFontData } from './bitmap-font-text-parser';
import { bitmapFontXMLParser } from './bitmap-font-xml-parser';

function parseXML(xml: string): XMLDocument {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'text/xml');
}

export const bitmapFontXMLStringParser = {
  test(data: string | XMLDocument | BitmapFontData): boolean {
    if (typeof data === 'string' && data.includes('<font>')) {
      return bitmapFontXMLParser.test(parseXML(data));
    }

    return false;
  },

  parse(data: string): BitmapFontData {
    return bitmapFontXMLParser.parse(parseXML(data));
  },
};
