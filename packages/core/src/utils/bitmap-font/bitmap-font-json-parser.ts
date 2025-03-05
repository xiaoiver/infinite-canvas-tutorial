import { BitmapFontData, RawCharData } from './bitmap-font-text-parser';

export const bitmapFontJSONParser = {
  test(data: string | BitmapFontData): boolean {
    try {
      JSON.parse(data as string);
      return true;
    } catch (e) {
      return false;
    }
  },

  parse(jsonStr: string): BitmapFontData {
    const data: BitmapFontData = {
      chars: {},
      pages: [],
      lineHeight: 0,
      fontSize: 0,
      fontFamily: '',
      distanceField: null,
      baseLineOffset: 0,
    };

    const json = JSON.parse(jsonStr);

    const info = json.info;
    const common = json.common;
    const distanceField = json.distanceField;

    if (distanceField) {
      data.distanceField = {
        type: distanceField.fieldType as 'sdf' | 'msdf' | 'none',
        range: distanceField.distanceRange,
      };
    }

    // pages and chars:
    const pages = json.pages;
    const chars = json.chars;
    const kernings = json.kernings;

    data.fontSize = info.size;
    data.fontFamily = info.face;
    data.lineHeight = common.lineHeight;

    for (let i = 0; i < pages.length; i++) {
      data.pages.push({
        id: pages[i]?.id || 0,
        file: pages[i]?.file || pages[i],
      });
    }

    const map: Record<string, string> = {};

    data.baseLineOffset = data.lineHeight - common.base;

    for (let i = 0; i < chars.length; i++) {
      const charNode = chars[i];
      const id = charNode.id;

      let letter = charNode.letter ?? charNode.char ?? String.fromCharCode(id);

      if (letter === 'space') letter = ' ';

      map[id] = letter;

      data.chars[letter] = {
        id,
        // texture deets..
        page: charNode.page || 0,
        x: charNode.x,
        y: charNode.y,
        width: charNode.width,
        height: charNode.height,

        // render deets..
        xOffset: charNode.xoffset,
        yOffset: charNode.yoffset, // + baseLineOffset,
        xAdvance: charNode.xadvance,
        kerning: {},
      } as RawCharData;
    }

    for (let i = 0; i < kernings.length; i++) {
      const kerningNode = kernings[i];
      const first = kerningNode.first;
      const second = kerningNode.second;
      const amount = kerningNode.amount;

      data.chars[map[second]].kerning[map[first]] = amount; // * 10000;
    }

    return data;
  },
};
