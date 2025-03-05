import { DOMAdapter } from '../../environment';
import { BitmapFontData } from './bitmap-font-text-parser';
import { bitmapFontXMLParser } from './bitmap-font-xml-parser';

export const bitmapFontXMLStringParser = {
  test(data: string | XMLDocument | BitmapFontData): boolean {
    if (typeof data === 'string' && data.includes('<font>')) {
      return bitmapFontXMLParser.test(
        DOMAdapter.get().getDOMParser()?.parseFromString(data, 'text/xml'),
      );
    }

    return false;
  },

  parse(data: string): BitmapFontData {
    return bitmapFontXMLParser.parse(
      DOMAdapter.get().getDOMParser()?.parseFromString(data, 'text/xml'),
    );
  },
};
