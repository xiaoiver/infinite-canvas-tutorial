import { Canvas } from '..';
import { Cursor } from '../events';
import { Adapter } from './adapter';
import { DOMParser } from '@xmldom/xmldom';

export const WebWorkerAdapter: Adapter = {
  createCanvas: (width?: number, height?: number) =>
    new OffscreenCanvas(width ?? 0, height ?? 0),
  getDocument: () => null,
  fetch: (url: RequestInfo, options?: RequestInit) => fetch(url, options),
  /**
   * @see https://stackoverflow.com/questions/33641622/dom-manipulation-inside-web-worker
   */
  getXMLSerializer: () => null,
  parseXML: (xml: string) => {
    const parser = new DOMParser();
    return parser.parseFromString(xml, 'text/xml') as unknown as Document;
  },
  /**
   * There is no `style.cursor = 'pointer'` in WebWorker.
   */
  setCursor: (canvas: Canvas, cursor: Cursor) => {},
  graphemeSegmenter: (s: string) => {
    if (typeof Intl?.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter();
      return [...segmenter.segment(s)].map((x) => x.segment);
    }
    return [...s];
  },
};
