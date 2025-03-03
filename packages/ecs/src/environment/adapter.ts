import { BrowserAdapter } from './BrowserAdapter';

export interface Adapter {
  createCanvas: (
    width?: number,
    height?: number,
  ) => HTMLCanvasElement | OffscreenCanvas;
  createTexImageSource: (
    canvas: HTMLCanvasElement | OffscreenCanvas,
  ) => TexImageSource;
  getDocument: () => Document;
  getXMLSerializer: () => XMLSerializer | null;
  getDOMParser: () => DOMParser | null;
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
