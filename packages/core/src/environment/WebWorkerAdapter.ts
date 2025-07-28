import { Canvas } from '..';
import { Cursor } from '../events';
import { Adapter } from './adapter';

export const WebWorkerAdapter: Adapter = {
  createCanvas: (width?: number, height?: number) =>
    new OffscreenCanvas(width ?? 0, height ?? 0),
  createTexImageSource: (canvas: HTMLCanvasElement | OffscreenCanvas) => canvas,
  getWindow: () => self,
  getDocument: () => null,
  /**
   * @see https://stackoverflow.com/questions/33641622/dom-manipulation-inside-web-worker
   */
  getXMLSerializer: () => null,
  getDOMParser: () => null,
  /**
   * There is no `style.cursor = 'pointer'` in WebWorker.
   */
  setCursor: (canvas: Canvas, cursor: Cursor) => {},
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
