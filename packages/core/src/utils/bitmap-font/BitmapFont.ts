import { Rectangle } from '@pixi/math';
import { AbstractBitmapFont } from './AbstractBitmapFont';
import { BitmapFontData } from './bitmap-font-text-parser';
import { Device, Format, TextureUsage } from '@antv/g-device-api';

export interface BitmapFontOptions {
  data: BitmapFontData;
  images: ImageBitmap[];
}

export class BitmapFont extends AbstractBitmapFont<BitmapFont> {
  constructor(private options: BitmapFontOptions) {
    super();
  }

  init(device: Device) {
    const { images, data } = this.options;

    const textures = images.map((image) => {
      const texture = device.createTexture({
        format: Format.U8_RGBA_NORM,
        width: image.width,
        height: image.height,
        usage: TextureUsage.SAMPLED,
      });
      texture.setImageData([image]);
      return texture;
    });

    Object.keys(data.pages).forEach((key: string) => {
      const pageData = data.pages[parseInt(key, 10)];

      const texture = textures[pageData.id];

      this.pages.push({ texture });
    });

    Object.keys(data.chars).forEach((key: string) => {
      const charData = data.chars[key];
      const texture = textures[charData.page];

      const frameReal = new Rectangle(
        // charData.x + textureFrame.x,
        // charData.y + textureFrame.y,
        charData.x,
        charData.y,
        charData.width,
        charData.height,
      );

      // @ts-ignore frame is not a property of Texture
      texture.frame = frameReal;

      this.chars[key] = {
        id: key.codePointAt(0),
        xOffset: charData.xOffset,
        yOffset: charData.yOffset,
        xAdvance: charData.xAdvance,
        kerning: charData.kerning ?? {},
        texture,
      };
    });

    this.baseRenderedFontSize = data.fontSize;

    (this.baseMeasurementFontSize as number) = data.fontSize;
    (this.fontMetrics as {
      ascent: number;
      descent: number;
      fontSize: number;
    }) = {
      ascent: 0,
      descent: 0,
      fontSize: data.fontSize,
    };
    (this.baseLineOffset as number) = data.baseLineOffset;
    (this.lineHeight as number) = data.lineHeight;
    (this.fontFamily as string) = data.fontFamily;
    (this.distanceField as { type: string; range: number }) =
      data.distanceField ?? {
        type: 'none',
        range: 0,
      };
  }

  public override destroy(): void {
    super.destroy();

    for (let i = 0; i < this.pages.length; i++) {
      const { texture } = this.pages[i];

      texture.destroy();
    }

    (this.pages as null) = null;
  }
}
