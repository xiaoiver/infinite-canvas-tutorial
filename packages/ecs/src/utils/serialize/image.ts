import { Texture } from '@antv/g-device-api';
import { DOMAdapter } from '../../environment';
import { isBrowser } from '..';

/**
 * Serialize an image to a data URL with Canvas2D API.
 */
export function serializeImage(source: ImageBitmap | HTMLImageElement): string {
  /**
   * We can't use bitmaprenderer since the ImageBitmap has been rendered in Texture.
   *
   * Error message: `The input ImageBitmap has been detached`
   * @see https://stackoverflow.com/questions/52959839/convert-imagebitmap-to-blob
   */
  const canvas = DOMAdapter.get().createCanvas(
    source.width,
    source.height,
  ) as HTMLCanvasElement;

  // We get the 2d drawing context and draw the image in the top left
  canvas.getContext('2d').drawImage(source, 0, 0);
  // get a bitmaprenderer context
  // const ctx = canvas.getContext('bitmaprenderer');
  // ctx.transferFromImageBitmap(bmp);
  // const blob = await new Promise<Blob>((res) => canvas.toBlob(res));
  return canvas.toDataURL();
}

export function serializeCanvasImageSource(
  source: CanvasImageSource | Texture,
): string {
  if (isBrowser) {
    if (source instanceof ImageBitmap) {
      return serializeImage(source);
    } else if (source instanceof HTMLImageElement) {
      return source.src;
    } else if (source instanceof HTMLCanvasElement) {
      return source.toDataURL();
    } else if (source instanceof HTMLVideoElement) {
      // won't support
    }
  } else {
    return serializeImage(source as ImageBitmap);
  }
}
