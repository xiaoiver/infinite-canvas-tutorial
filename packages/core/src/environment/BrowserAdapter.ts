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
  getDocument: () => document,
  fetch: (url: RequestInfo, options?: RequestInit) => fetch(url, options),
  getXMLSerializer: () => new XMLSerializer(),
  parseXML: (xml: string) => {
    const parser = new DOMParser();

    return parser.parseFromString(xml, 'text/xml');
  },
  setCursor: (canvas: Canvas, cursor: Cursor) => {
    const $canvas = canvas.getDOM() as HTMLCanvasElement;
    if (!$canvas.style) {
      return;
    }

    canvas.root.cursor = cursor;
    $canvas.style.cursor = cursor;
  },
  graphemeSegmenter: (s: string) => {
    if (typeof Intl?.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter();
      return [...segmenter.segment(s)].map((x) => x.segment);
    }
    return [...s];
  },
};
