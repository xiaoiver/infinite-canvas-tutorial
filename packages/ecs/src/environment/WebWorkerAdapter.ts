import { Adapter } from './adapter';
import { loadImageBitmapUniversal } from '../utils/load-image-bitmap';

export const WebWorkerAdapter: Adapter = {
  createCanvas: (width?: number, height?: number) =>
    new OffscreenCanvas(width ?? 0, height ?? 0),
  createTexImageSource: (canvas: HTMLCanvasElement | OffscreenCanvas) => canvas,
  createImage: (src: string | Blob) => loadImageBitmapUniversal(src),
  getWindow: () => self,
  getDocument: () => null,
  /**
   * @see https://stackoverflow.com/questions/33641622/dom-manipulation-inside-web-worker
   */
  getXMLSerializer: () => null,
  getDOMParser: () => null,
  splitGraphemes: (s: string) => {
    if (typeof Intl?.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter();
      return [...segmenter.segment(s)].map((x) => x.segment);
    }
    return [...s];
  },
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    requestAnimationFrame(callback),
  cancelAnimationFrame: (id: number) => cancelAnimationFrame(id),
};
