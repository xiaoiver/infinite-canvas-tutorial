import type { Texture } from '@infinite-canvas-tutorial/device-api';
import { DOMAdapter } from '../environment';

/**
 * 将 2D 栅格画布上传到 GPU 纹理。Node / headless-gl 下需经 {@link Adapter.createTexImageSource}
 *（如 PNG → RGBA）；浏览器通常可直接上传 canvas。
 */
export function upload2DRasterCanvasToTexture(
  texture: Texture,
  canvas: HTMLCanvasElement | OffscreenCanvas,
): void {
  const src = DOMAdapter.get().createTexImageSource(
    canvas as HTMLCanvasElement,
  );
  texture.setImageData([src as TexImageSource]);
}
