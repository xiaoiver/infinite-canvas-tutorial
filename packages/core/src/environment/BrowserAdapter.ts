import { ImageLoader } from '@loaders.gl/images';
import { Canvas } from '..';
import { Cursor } from '../events';
import { Adapter } from './adapter';
import { load } from '@loaders.gl/core';

export const BrowserAdapter: Adapter = {
  createCanvas: (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    return canvas;
  },
  createTexImageSource: (canvas: HTMLCanvasElement | OffscreenCanvas) => canvas,
  createImage: (src: string | Blob) => {
    if (typeof src === 'string') {
      return load(src, ImageLoader);
    }
    const url = URL.createObjectURL(src);
    return load(url, ImageLoader).finally(() => URL.revokeObjectURL(url));
  },
  getWindow: () => window,
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
