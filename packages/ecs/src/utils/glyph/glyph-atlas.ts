import potpack from 'potpack';
import type { GlyphMetrics, StyleGlyph } from './alpha-image';
import { RGBAImage } from './alpha-image';

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
export const SDF_SCALE = 4;
export const BASE_FONT_WIDTH = 24 * SDF_SCALE;
export const BASE_FONT_BUFFER = 3 * SDF_SCALE;
export const RADIUS = 8 * SDF_SCALE;

export const glyphPadding = 1;
/**
 * The glyph padding is just to prevent sampling errors at the boundaries between
 * glyphs in the atlas texture, and for that purpose there's no need to make it
 * bigger with high-res SDFs. However, layout is done based on the glyph size
 * including this padding, so scaling this padding is the easiest way to keep
 * layout exactly the same as the SDF_SCALE changes.
 */
const padding = glyphPadding * SDF_SCALE;

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GlyphPosition = {
  rect: Rect;
  metrics: GlyphMetrics;
};

export type GlyphPositions = Record<string, Record<string, GlyphPosition>>;

/**
 * Merge SDFs into a large squared atlas with `potpack`,
 * because on WebGL1 context, all textures are resized to a power of two to produce the best quality.
 *
 * @see https://doc.babylonjs.com/advanced_topics/webGL2#power-of-two-textures
 */
export class GlyphAtlas {
  image: RGBAImage;
  positions: GlyphPositions;

  constructor(stacks: Record<string, Record<string, StyleGlyph>>) {
    const positions = {};
    const bins: {
      x: number;
      y: number;
      w: number;
      h: number;
    }[] = [];

    for (const stack in stacks) {
      const glyphs = stacks[stack];
      const stackPositions = (positions[stack] = {});

      for (const id in glyphs) {
        const src = glyphs[id];
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

        const bin = {
          x: 0,
          y: 0,
          w: src.bitmap.width + 2 * padding,
          h: src.bitmap.height + 2 * padding,
        };
        bins.push(bin);
        stackPositions[id] = { rect: bin, metrics: src.metrics };
      }
    }

    const { w, h } = potpack(bins);
    const image = new RGBAImage({ width: w || 1, height: h || 1 });

    for (const stack in stacks) {
      const glyphs = stacks[stack];

      for (const id in glyphs) {
        const src = glyphs[id];
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

        const bin = positions[stack][id].rect;
        RGBAImage.copy(
          src.bitmap,
          image,
          { x: 0, y: 0 },
          { x: bin.x + padding, y: bin.y + padding },
          src.bitmap,
        );
      }
    }

    this.image = image;
    this.positions = positions;
  }
}
