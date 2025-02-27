import { Canvas } from '..';
import { Cursor } from '../events';
import { Adapter } from './adapter';

export const BrowserAdapter: Adapter = {
  createCanvas: (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  },
  createImage: () => {
    return new Image();
  },
  getDocument: () => document,
  getXMLSerializer: () => new XMLSerializer(),
  getDOMParser: () => new DOMParser(),
  setCursor: (canvas: Canvas, cursor: Cursor) => {
    const $canvas = canvas.getDOM() as HTMLCanvasElement;
    if (!$canvas.style) {
      return;
    }

    canvas.root.cursor = cursor;
    $canvas.style.cursor = cursor;
  },
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
