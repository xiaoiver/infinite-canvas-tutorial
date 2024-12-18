import potpack from 'potpack';
import type { GlyphMetrics, StyleGlyph } from './alpha-image';
import { AlphaImage } from './alpha-image';
import { SDF_SCALE } from './glyph-manager';

const glyphPadding = 1;
/*
    The glyph padding is just to prevent sampling errors at the boundaries between
    glyphs in the atlas texture, and for that purpose there's no need to make it
    bigger with high-res SDFs. However, layout is done based on the glyph size
    including this padding, so scaling this padding is the easiest way to keep
    layout exactly the same as the SDF_SCALE changes.
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

export type GlyphPositions = Record<string, Record<number, GlyphPosition>>;

/**
 * Merge SDFs into a large squared atlas with `potpack`,
 * because on WebGL1 context, all textures are resized to a power of two to produce the best quality.
 *
 * @see https://doc.babylonjs.com/advanced_topics/webGL2#power-of-two-textures
 */
export class GlyphAtlas {
  image: AlphaImage;
  positions: GlyphPositions;

  constructor(stacks: Record<string, Record<number, StyleGlyph>>) {
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
        const src = glyphs[+id];
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
    const image = new AlphaImage({ width: w || 1, height: h || 1 });

    for (const stack in stacks) {
      const glyphs = stacks[stack];

      for (const id in glyphs) {
        const src = glyphs[+id];
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

        const bin = positions[stack][id].rect;
        AlphaImage.copy(
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
