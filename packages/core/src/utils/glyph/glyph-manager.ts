/**
 * @see https://github.com/mapbox/mapbox-gl-js/blob/main/src/render/glyph_manager.ts
 */

import type { Device, Texture } from '@antv/g-device-api';
import { Format, makeTextureDescriptor2D } from '@antv/g-device-api';
import TinySDF from '@mapbox/tiny-sdf';
import type { StyleGlyph } from './alpha-image';
import { AlphaImage } from './alpha-image';
import { GlyphAtlas } from './glyph-atlas';

export type PositionedGlyph = {
  glyph: number; // charCode
  x: number;
  y: number;
  scale: number; // 根据缩放等级计算的缩放比例
  fontStack: string;
};

/*
  SDF_SCALE controls the pixel density of locally generated glyphs relative
  to "normal" SDFs which are generated at 24pt font and a "pixel ratio" of 1.
  The GlyphManager will generate glyphs SDF_SCALE times as large,
  but with the same glyph metrics, and the quad generation code will scale them
  back down so they display at the same size.

  The choice of SDF_SCALE is a trade-off between performance and quality.
  Glyph generation time grows quadratically with the the scale, while quality
  improvements drop off rapidly when the scale is higher than the pixel ratio
  of the device. The scale of 2 buys noticeable improvements on HDPI screens
  at acceptable cost.

  The scale can be any value, but in order to avoid small distortions, these
  pixel-based values must come out to integers:
   - "localGlyphPadding" in GlyphAtlas
   - Font/Canvas/Buffer size for TinySDF
  localGlyphPadding + buffer should equal 4 * SDF_SCALE. So if you wanted to
  use an SDF_SCALE of 1.75, you could manually set localGlyphAdding to 2 and
  buffer to 5.
*/
export const SDF_SCALE = 1;
export const BASE_FONT_WIDTH = 24 * SDF_SCALE;
export const BASE_FONT_BUFFER = 3 * SDF_SCALE;
export const radius = 8 * SDF_SCALE;

export function getDefaultCharacterSet(): string[] {
  const charSet = [];
  for (let i = 32; i < 128; i++) {
    charSet.push(String.fromCharCode(i));
  }
  return charSet;
}

/**
 * TODO: use one atlas for all fontstacks, each fontstack has one texture now
 */
export class GlyphManager {
  private sdfGeneratorCache: Record<string, TinySDF> = {};

  private textMetricsCache: Record<string, Record<string, number>> = {};

  private glyphAtlas: GlyphAtlas;
  private glyphMap: Record<string, Record<number, StyleGlyph>> = {};
  private glyphAtlasTexture: Texture;

  constructor() {}

  destroy() {
    if (this.glyphAtlasTexture) {
      this.glyphAtlasTexture.destroy();
    }
  }

  getMap() {
    return this.glyphMap;
  }

  getAtlas() {
    return this.glyphAtlas;
  }

  getAtlasTexture() {
    return this.glyphAtlasTexture;
  }

  layout(
    lines: string[],
    fontStack: string,
    lineHeight: number,
    textAlign: CanvasTextAlign | 'middle',
    letterSpacing: number,
    offsetX: number,
    offsetY: number,
    fontMetrics: globalThis.TextMetrics & { fontSize: number },
  ): PositionedGlyph[] {
    const positionedGlyphs: PositionedGlyph[] = [];

    let x = offsetX;
    let y = offsetY;

    const justify =
      // eslint-disable-next-line no-nested-ternary
      textAlign === 'right' || textAlign === 'end'
        ? 1
        : textAlign === 'left' || textAlign === 'start'
        ? 0
        : 0.5;

    lines.forEach((line) => {
      const lineStartIndex = positionedGlyphs.length;
      Array.from(line).forEach((char) => {
        // fontStack
        const positions = this.glyphMap[fontStack];
        const charCode = char.charCodeAt(0);
        const glyph = positions && positions[charCode];

        if (glyph) {
          const glyphOffset = -fontMetrics.fontBoundingBoxAscent;

          positionedGlyphs.push({
            glyph: charCode,
            x,
            y: y + glyphOffset,
            scale: 1,
            fontStack,
          });
          x += glyph.metrics.advance + letterSpacing;
        }
      });

      const lineWidth = x - letterSpacing;
      for (let i = lineStartIndex; i < positionedGlyphs.length; i++) {
        positionedGlyphs[i].x -= justify * lineWidth;
      }

      x = 0;
      y += lineHeight;
    });

    return positionedGlyphs;
  }

  generateAtlas(
    fontStack = '',
    fontFamily: string,
    fontWeight: string,
    fontStyle = '',
    text: string,
    device: Device,
  ) {
    let newChars: string[] = [];
    if (!this.glyphMap[fontStack]) {
      newChars = getDefaultCharacterSet();
    }

    const existedChars = Object.keys(this.glyphMap[fontStack] || {});
    // TODO: grapheme cluster
    Array.from(new Set(text.split(''))).forEach((char) => {
      if (existedChars.indexOf(char.charCodeAt(0).toString()) === -1) {
        newChars.push(char);
      }
    });

    if (newChars.length) {
      const glyphMap = newChars
        .map((char) => {
          return this.generateSDF(
            fontStack,
            fontFamily,
            fontWeight,
            fontStyle,
            char,
          );
        })
        .reduce((prev, cur) => {
          // @ts-ignore
          prev[cur.id] = cur;
          return prev;
        }, {}) as StyleGlyph;

      this.glyphMap[fontStack] = {
        ...this.glyphMap[fontStack],
        ...glyphMap,
      };
      this.glyphAtlas = new GlyphAtlas(this.glyphMap);
      const {
        width: atlasWidth,
        height: atlasHeight,
        data,
      } = this.glyphAtlas.image;

      if (this.glyphAtlasTexture) {
        this.glyphAtlasTexture.destroy();
      }

      this.glyphAtlasTexture = device.createTexture({
        ...makeTextureDescriptor2D(
          device.queryVendorInfo().platformString === 'WebGPU'
            ? Format.U8_R_NORM
            : Format.U8_LUMINANCE,
          atlasWidth,
          atlasHeight,
          1,
        ),
        pixelStore: {
          unpackFlipY: false,
          unpackAlignment: 1,
        },
      });
      this.glyphAtlasTexture.setImageData([data]);
    }
  }

  private generateSDF(
    fontStack = '',
    fontFamily: string,
    fontWeight: string,
    fontStyle: string,
    char: string,
  ): StyleGlyph {
    const charCode = char.charCodeAt(0);
    let sdfGenerator = this.sdfGeneratorCache[fontStack];
    if (!sdfGenerator) {
      sdfGenerator = this.sdfGeneratorCache[fontStack] = new TinySDF({
        fontSize: BASE_FONT_WIDTH,
        fontFamily,
        fontWeight,
        fontStyle,
        buffer: BASE_FONT_BUFFER,
        radius,
      });
    }

    if (!this.textMetricsCache[fontStack]) {
      this.textMetricsCache[fontStack] = {};
    }

    if (!this.textMetricsCache[fontStack][char]) {
      // 使用 mapbox/tiny-sdf 中的 context
      // @see https://stackoverflow.com/questions/46126565/how-to-get-font-glyphs-metrics-details-in-javascript
      this.textMetricsCache[fontStack][char] =
        // @ts-ignore
        sdfGenerator.ctx.measureText(char).width;
    }

    // use sdf 2.x @see https://github.com/mapbox/tiny-sdf
    const {
      data,
      width,
      height,
      glyphWidth,
      glyphHeight,
      glyphLeft,
      glyphTop,
      glyphAdvance,
    } = sdfGenerator.draw(char);

    // console.log(
    //   width,
    //   height,
    //   glyphWidth,
    //   glyphHeight,
    //   glyphLeft,
    //   glyphTop,
    //   glyphAdvance,
    // );

    // const baselineAdjustment = 27;

    return {
      id: charCode,
      // 在 canvas 中绘制字符，使用 Uint8Array 存储 30*30 sdf 数据
      bitmap: new AlphaImage(
        {
          width,
          height,
        },
        data,
      ),
      metrics: {
        // width: glyphWidth,
        // height: glyphHeight,
        // left: glyphLeft,
        // top: glyphTop - BASE_FONT_WIDTH + BASE_FONT_BUFFER,
        // advance: glyphAdvance,

        width: glyphWidth / SDF_SCALE,
        height: glyphHeight / SDF_SCALE,
        left: glyphLeft / SDF_SCALE,
        top: glyphTop / SDF_SCALE,
        advance: glyphAdvance / SDF_SCALE,
      },
    };
  }
}
