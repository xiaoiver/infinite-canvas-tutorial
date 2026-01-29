/**
 * @see https://github.com/mapbox/mapbox-gl-js/blob/main/src/render/glyph_manager.ts
 */

import type { Device, Texture } from '@antv/g-device-api';
import { Format, makeTextureDescriptor2D } from '@antv/g-device-api';
import type { StyleGlyph } from './alpha-image';
import { RGBAImage } from './alpha-image';
import { BASE_FONT_BUFFER, BASE_FONT_WIDTH, GlyphAtlas, RADIUS, SDF_SCALE } from './glyph-atlas';
import { TinySDF } from './tiny-sdf';
import { BitmapFont } from '../bitmap-font/BitmapFont';
import { DOMAdapter } from '../../environment';

export type PositionedGlyph = {
  glyph: string;
  x: number;
  y: number;
  scale: number;
  fontStack: string;
};


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

  constructor() { }

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
  ): PositionedGlyph[] {
    const positionedGlyphs: PositionedGlyph[] = [];

    let x = dx ?? 0;
    let y = dy ?? 0;

    const justify =
      textAlign === 'right' || textAlign === 'end'
        ? 1
        : textAlign === 'left' || textAlign === 'start'
          ? 0
          : 0.5;

    lines.forEach((line) => {
      const lineStartIndex = positionedGlyphs.length;

      let previousChar: string;
      DOMAdapter.get()
        .splitGraphemes(line)
        .forEach((char) => {
          let advance: number;
          let kerning = 0;
          if (bitmapFont) {
            const charData = bitmapFont.chars[char];
            advance = charData.xAdvance;
            kerning =
              (bitmapFontKerning &&
                previousChar &&
                charData.kerning[previousChar]) ||
              0;
          } else {
            const positions = this.glyphMap[fontStack];
            const glyph = positions && positions[char];
            advance = glyph.metrics.advance;
          }

          positionedGlyphs.push({
            glyph: char,
            x: x,
            y: y,
            scale,
            fontStack,
          });
          x += (advance + kerning) * scale + letterSpacing;

          previousChar = char;
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
