import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';
import { BitmapFont } from './BitmapFont';
import { bitmapFontTextParser } from './bitmap-font-text-parser';
import { bitmapFontXMLStringParser } from './bitmap-font-xml-string-parser';
import { bitmapFontJSONParser } from './bitmap-font-json-parser';

const validExtensions = ['.xml', '.fnt'];

export const loadBitmapFont = {
  test(url: string): boolean {
    return validExtensions.includes(url.split('.').pop().toLowerCase());
  },

  async parse(asset: string): Promise<BitmapFont> {
    const bitmapFontData = bitmapFontJSONParser.test(asset)
      ? bitmapFontJSONParser.parse(asset)
      : bitmapFontTextParser.test(asset)
      ? bitmapFontTextParser.parse(asset)
      : bitmapFontXMLStringParser.parse(asset);

    const { pages } = bitmapFontData;
    const textureUrls = [];

    // if we have a distance field - we can assume this is a signed distance field font
    // and we should use force linear filtering and no alpha premultiply
    const textureOptions = bitmapFontData.distanceField
      ? {
          scaleMode: 'linear',
          alphaMode: 'premultiply-alpha-on-upload',
          autoGenerateMipmaps: false,
          resolution: 1,
        }
      : {};

    for (let i = 0; i < pages.length; ++i) {
      const pageFile = pages[i].file;
      const imagePath = pageFile;

      // imagePath = copySearchParams(imagePath, src);

      textureUrls.push({
        src: imagePath,
        data: textureOptions,
      });
    }

    const images = await Promise.all(
      textureUrls.map(
        async ({ src }) => (await load(src, ImageLoader)) as ImageBitmap,
      ),
    );

    return new BitmapFont({
      data: bitmapFontData,
      images,
    });
  },
};
