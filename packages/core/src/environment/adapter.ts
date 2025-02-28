import { Canvas } from '..';
import { Cursor } from '../events';
import { BrowserAdapter } from './BrowserAdapter';

export interface Adapter {
  createCanvas: (
    width?: number,
    height?: number,
  ) => HTMLCanvasElement | OffscreenCanvas;
  getDocument: () => Document;
  getXMLSerializer: () => XMLSerializer | null;
  getDOMParser: () => DOMParser | null;
  setCursor: (canvas: Canvas, cursor: Cursor) => void;
  splitGraphemes: (s: string) => string[];
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
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
