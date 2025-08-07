import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';
import { Adapter } from './adapter';

export const WebWorkerAdapter: Adapter = {
  createCanvas: (width?: number, height?: number) =>
    new OffscreenCanvas(width ?? 0, height ?? 0),
  createTexImageSource: (canvas: HTMLCanvasElement | OffscreenCanvas) => canvas,
  createImage: (src: string) => load(src, ImageLoader),
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
