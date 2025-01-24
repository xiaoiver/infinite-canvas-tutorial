import { DOMAdapter } from '../environment/adapter';

export const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

export const getGlobalThis = (): typeof globalThis => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof self !== 'undefined') return self;
  if (typeof window !== 'undefined') return window;
  // @ts-ignore
  if (typeof global !== 'undefined') return global;
  // @ts-ignore
  return {};
  // [!] Error: The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten
  // @see https://rollupjs.org/troubleshooting/#error-this-is-undefined
  // if (typeof this !== 'undefined') return this;
};

export function createSVGElement(type: string): SVGElement {
  return DOMAdapter.get()
    .getDocument()
    .createElementNS('http://www.w3.org/2000/svg', type);
}

export function isImageBitmapOrCanvases(
  data: TexImageSource,
): data is ImageBitmap | HTMLCanvasElement | OffscreenCanvas {
  return (
    isBrowser &&
    (data instanceof ImageBitmap ||
      data instanceof HTMLCanvasElement ||
      data instanceof OffscreenCanvas)
  );
}

export function isVideo(data: TexImageSource): data is HTMLVideoElement {
  return isBrowser && data instanceof HTMLVideoElement;
}
