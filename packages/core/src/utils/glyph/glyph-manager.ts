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
import { parsePath } from '..';
import { Path } from '../curve/path';

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

    const reverse = side === 'right';
    let totalPathLength = 0;
    let path: Path;
    if (d) {
      parsePath(d).subPaths.forEach((subPath) => {
        path = subPath;
        totalPathLength += subPath.getLength();
      });
    }

    lines.forEach((line) => {
      let positionInPath = 0;
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

          const width = (advance + kerning) * scale + letterSpacing;
          positionedGlyphs.push({
            glyph: char,
            x: x,
            y: y,
            scale,
            fontStack,
            width,
          });
          x += width;

          previousChar = char;
        });

      const lineWidth = x - letterSpacing;
      for (let i = lineStartIndex; i < positionedGlyphs.length; i++) {
        positionedGlyphs[i].x -= justify * lineWidth;
      }

      x = 0;
      y += lineHeight;

      const llength = positionedGlyphs.length - lineStartIndex;

      if (d) {
        if (textAlign === 'left') {
          positionInPath = reverse ? totalPathLength - lineWidth : 0;
        } else if (textAlign === 'right') {
          positionInPath = reverse ? 0 : totalPathLength - lineWidth;
        } else if (textAlign === 'center') {
          positionInPath = (totalPathLength - lineWidth) / 2;
        }
        positionInPath += startOffset * (reverse ? -1 : 1);

        for (
          let i = reverse ? llength - 1 : 0;
          reverse ? i >= 0 : i < llength;
          reverse ? i-- : i++
        ) {
          const positionedGlyph = positionedGlyphs[i];
          if (positionInPath > totalPathLength) {
            positionInPath %= totalPathLength;
          } else if (positionInPath < 0) {
            positionInPath += totalPathLength;
          }
          // it would probably much faster to send all the grapheme position for a line
          // and calculate path position/angle at once.
          this.layoutOnPath(
            path,
            positionInPath,
            totalPathLength,
            positionedGlyph,
          );
          positionInPath += positionedGlyph.width;
        }
      }
    });

    return positionedGlyphs;
  }

  layoutOnPath(
    path: Path,
    positionInPath: number,
    totalPathLength: number,
    positionedGlyph: PositionedGlyph,
  ) {
    const centerPosition = positionInPath + positionedGlyph.width / 2;
    const ratio = centerPosition / totalPathLength;
    const point = path.getPointAt(ratio);
    const tangent = path.getTangentAt(ratio);
    const rotation = Math.atan2(tangent[1], tangent[0]);
    if (point) {
      positionedGlyph.x = point[0];
      positionedGlyph.y = point[1];
      positionedGlyph.rotation = rotation;
    }
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
