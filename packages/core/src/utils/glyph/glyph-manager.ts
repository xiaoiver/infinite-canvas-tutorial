/**
 * @see https://github.com/mapbox/mapbox-gl-js/blob/main/src/render/glyph_manager.ts
 */

import type { Device, Texture } from '@antv/g-device-api';
import { Format, makeTextureDescriptor2D } from '@antv/g-device-api';
import type { StyleGlyph } from './alpha-image';
import { RGBAImage } from './alpha-image';
import { GlyphAtlas } from './glyph-atlas';
import { TinySDF } from './tiny-sdf';
import { BitmapFont } from '../bitmap-font/BitmapFont';
import { DOMAdapter } from '../../environment';
import { layoutGlyphs } from './text-path';

export type PositionedGlyph = {
  glyph: string;
  x: number;
  y: number;
  scale: number;
  fontStack: string;
  width: number;
  rotation?: number;
};

/**
 * SDF_SCALE controls the pixel density of locally generated glyphs relative
 * to "normal" SDFs which are generated at 24pt font and a "pixel ratio" of 1.
 * The GlyphManager will generate glyphs SDF_SCALE times as large,
 * but with the same glyph metrics, and the quad generation code will scale them
 * back down so they display at the same size.
 *
 * The choice of SDF_SCALE is a trade-off between performance and quality.
 * Glyph generation time grows quadratically with the the scale, while quality
 * improvements drop off rapidly when the scale is higher than the pixel ratio
 * of the device. The scale of 2 buys noticeable improvements on HDPI screens
 * at acceptable cost.
 */
export const SDF_SCALE = 2;
export const BASE_FONT_WIDTH = 24 * SDF_SCALE;
export const BASE_FONT_BUFFER = 3 * SDF_SCALE;
export const RADIUS = 8 * SDF_SCALE;

export function getDefaultCharacterSet(): string[] {
  const charSet = [];
  for (let i = 32; i < 128; i++) {
    charSet.push(String.fromCharCode(i));
  }
  return charSet;
}

export class GlyphManager {
  private sdfGeneratorCache: Record<string, TinySDF> = {};

  private glyphAtlas: GlyphAtlas;
  private glyphMap: Record<string, Record<string, StyleGlyph>> = {};
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
    textAlign: CanvasTextAlign,
    letterSpacing: number,
    bitmapFont?: BitmapFont,
    scale?: number,
    bitmapFontKerning?: boolean,
    dx?: number,
    dy?: number,
    d?: string,
    side?: 'left' | 'right',
    startOffset?: number,
    pathOffset?: number,
  ): PositionedGlyph[] {
    const fontScale = scale ?? 1;
    return layoutGlyphs(
      lines,
      (line) => DOMAdapter.get().splitGraphemes(line),
      (char, previous) => {
        const bitmap = bitmapFont?.chars[char];
        const glyph = this.glyphMap[fontStack]?.[char];
        return {
          width: (bitmap?.xAdvance ?? glyph?.metrics.advance ?? 0) * fontScale,
          kerning:
            bitmapFontKerning && previous
              ? (bitmap?.kerning[previous] ?? 0) * fontScale
              : 0,
          scale: fontScale,
          fontStack,
        };
      },
      {
        lineHeight,
        textAlign,
        letterSpacing,
        dx,
        dy,
        path: d,
        side,
        startOffset,
        pathOffset,
      },
    );
  }

  generateAtlas(
    fontStack = '',
    fontFamily: string,
    fontWeight: string,
    fontStyle = '',
    text: string,
    device: Device,
    esdt: boolean,
    fill: string,
  ) {
    let newChars: string[] = [];
    if (!this.glyphMap[fontStack]) {
      newChars = getDefaultCharacterSet();
    }

    const existedChars = Object.keys(this.glyphMap[fontStack] || {});
    Array.from(new Set(DOMAdapter.get().splitGraphemes(text))).forEach(
      (char) => {
        if (existedChars.indexOf(char) === -1) {
          newChars.push(char);
        }
      },
    );

    if (newChars.length) {
      const glyphMap = newChars
        .map((char) => {
          return this.generateSDF(
            fontStack,
            fontFamily,
            fontWeight,
            fontStyle,
            char,
            esdt,
            fill,
          );
        })
        .reduce((prev, cur) => {
          prev[cur.id] = cur;
          return prev;
        }, {}) as StyleGlyph;

      // @ts-ignore
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
          Format.U8_RGBA_NORM,
          atlasWidth,
          atlasHeight,
          1,
        ),
        // pixelStore: {
        //   unpackFlipY: false,
        //   unpackAlignment: 4,
        // },
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
    esdt: boolean,
    fill: string,
  ): StyleGlyph {
    let sdfGenerator = this.sdfGeneratorCache[fontStack + fill];
    if (!sdfGenerator) {
      sdfGenerator = this.sdfGeneratorCache[fontStack + fill] = new TinySDF({
        fontSize: BASE_FONT_WIDTH,
        fontFamily,
        fontWeight,
        fontStyle,
        buffer: BASE_FONT_BUFFER,
        radius: RADIUS,
        fill,
      });
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
    } = sdfGenerator.draw(char, esdt, !!fill);

    return {
      id: char,
      // 在 canvas 中绘制字符，使用 Uint8Array 存储 30*30 sdf 数据
      bitmap: new RGBAImage(
        {
          width,
          height,
        },
        data,
      ),
      metrics: {
        width: glyphWidth / SDF_SCALE,
        height: glyphHeight / SDF_SCALE,
        left: glyphLeft / SDF_SCALE,
        top: glyphTop / SDF_SCALE,
        advance: glyphAdvance / SDF_SCALE,
      },
    };
  }
}
