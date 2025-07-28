import { Adapter } from './adapter';

export const BrowserAdapter: Adapter = {
  createCanvas: (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  },
  createTexImageSource: (canvas: HTMLCanvasElement | OffscreenCanvas) => canvas,
  getWindow: () => window,
  getDocument: () => document,
  getXMLSerializer: () => new XMLSerializer(),
  getDOMParser: () => new DOMParser(),
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
