import type { Texture } from '@infinite-canvas-tutorial/device-api';
import type { FillLayerItem } from './fillLayers';

/**
 * Compose unfiltered paints before applying a shape's filter. Intermediate layer
 * textures belong to this operation; the returned texture belongs to its caller.
 * A filter chain must never be rebuilt once per layer: that destroys outputs
 * still needed by the subsequent composition pass.
 */
export function createComposedFillTexture(
  layers: FillLayerItem[],
  rasterize: (layer: FillLayerItem) => Texture,
  compose: (textures: Texture[], width: number, height: number) => Texture,
): { texture: Texture; width: number; height: number } {
  if (layers.length < 2)
    throw new Error('At least two fill layers are required');
  const textures: Texture[] = [];
  try {
    for (const layer of layers) textures.push(rasterize(layer));
    const sizes = textures as (Texture & { width: number; height: number })[];
    const width = Math.max(1, ...sizes.map((texture) => texture.width));
    const height = Math.max(1, ...sizes.map((texture) => texture.height));
    return { texture: compose(textures, width, height), width, height };
  } finally {
    for (const texture of textures) texture.destroy();
  }
}
