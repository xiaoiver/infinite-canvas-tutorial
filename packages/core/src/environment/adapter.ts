import { Canvas } from '..';
import { Cursor } from '../events';
import { BrowserAdapter } from './BrowserAdapter';

export interface Adapter {
  createCanvas: (
    width?: number,
    height?: number,
  ) => HTMLCanvasElement | OffscreenCanvas;
  getDocument: () => Document;
  fetch: (url: RequestInfo, options?: RequestInit) => Promise<Response>;
  getXMLSerializer: () => XMLSerializer | null;
  parseXML: (xml: string) => Document | null;
  setCursor: (canvas: Canvas, cursor: Cursor) => void;
  graphemeSegmenter: (s: string) => string[];
}

let currentAdapter: Adapter = BrowserAdapter;

export const DOMAdapter = {
  /**
   * Returns the current adapter.
   */
  get(): Adapter {
    return currentAdapter;
  },
  /**
   * Sets the current adapter.
   */
  set(adapter: Adapter): void {
    currentAdapter = adapter;
  },
};
