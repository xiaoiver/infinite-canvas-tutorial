import { DOMAdapter } from '@infinite-canvas-tutorial/ecs';
import { imageDataToPencilTexture, type PencilTextureData } from './pencilDrawing';

const textureByUrl = new Map<string, Promise<PencilTextureData>>();
const textureReadyByUrl = new Map<string, PencilTextureData>();

export const COLOR_PENCIL_TEXTURE_DEFAULT_URL = '/pencil-texture.jpg';

export function getColorPencilTextureIfReady(url: string): PencilTextureData | undefined {
  return textureReadyByUrl.get(url.trim());
}

export function loadColorPencilTextureCached(url: string): Promise<PencilTextureData> {
  const key = url.trim() || COLOR_PENCIL_TEXTURE_DEFAULT_URL;
  const ready = textureReadyByUrl.get(key);
  if (ready) {
    return Promise.resolve(ready);
  }
  let pending = textureByUrl.get(key);
  if (!pending) {
    pending = DOMAdapter.get()
      .createImage(key)
      .then((bmp) => {
        const bitmap = bmp as ImageBitmap;
        const canvas = DOMAdapter.get().createCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        const tex = imageDataToPencilTexture(imageData);
        textureReadyByUrl.set(key, tex);
        return tex;
      })
      .catch((err) => {
        textureByUrl.delete(key);
        throw err;
      });
    textureByUrl.set(key, pending);
  }
  return pending;
}
