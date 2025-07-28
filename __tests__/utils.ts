import _gl from 'gl';
import { createCanvas } from 'canvas';
import getPixels from 'get-pixels';
import { JSDOM } from 'jsdom';
import { XMLSerializer } from '@xmldom/xmldom';
import GraphemeSplitter from 'grapheme-splitter';
import parsePNG from 'pngparse-sync';
import { Adapter } from '../packages/core/src/environment';

export function sleep(n: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, n);
  });
}

export function loadImage(path: string) {
  // Load local image instead of fetching remote URL.
  // @see https://github.com/stackgl/headless-gl/pull/53/files#diff-55563b6c0b90b80aed19c83df1c51e80fd45d2fbdad6cc047ee86e98f65da3e9R83
  return new Promise((resolve, reject) => {
    getPixels(path, function (err, image) {
      if (err) {
        reject('Bad image path');
      } else {
        image.width = image.shape[0];
        image.height = image.shape[1];
        resolve(image);
      }
    });
  });
}

export function getCanvas(width = 100, height = 100) {
  let gl = _gl(width, height, {
    antialias: false,
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const canvas = createCanvas(width, height);

  const dom = new JSDOM();
  const document = dom.window._document;

  const mockedCanvas: HTMLCanvasElement = {
    width,
    height,
    // @ts-ignore
    getContext: (contextId: string) => {
      if (contextId === '2d') {
        return canvas.getContext('2d');
      } else {
        // @ts-ignore
        gl.canvas = mockedCanvas;
        return gl;
      }
    },
    dispatchEvent: (event) => {
      document.dispatchEvent(event);
      return true;
    },
    addEventListener: (type, listener) => {
      document.addEventListener(type, listener);
    },
    removeEventListener: (type, listener) => {
      // document.removeEventListener(type, listener);
    },
    // @ts-ignore
    toDataURL: (...args) => canvas.toDataURL(...args),
    // @ts-ignore
    toBuffer: (...args) => canvas.toBuffer(...args),
  };

  return mockedCanvas;
}

export function createMouseEvent(type: string, options: any = {}) {
  const window = new JSDOM().window;
  return new (window as any).MouseEvent(type, {
    altKey: false,
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    composed: true,
    ctrlKey: false,
    detail: 0,
    height: 1,
    isPrimary: true,
    metaKey: false,
    movementX: 0,
    movementY: 0,
    pointerId: 1,
    pointerType: 'mouse',
    pressure: 0.5,
    relatedTarget: null,
    screenX: 0,
    screenY: 0,
    shiftKey: false,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    view: window,
    which: 1,
    width: 1,
    ...options,
  });
}

let lastTime = 0;
export const NodeJSAdapter: Adapter = {
  createCanvas: (width?: number, height?: number) =>
    getCanvas(width ?? 0, height ?? 0),
  createTexImageSource: (canvas) => {
    // convert Image in node-canvas to ImageData in headless-gl
    // @ts-ignore
    const buffer = canvas.toBuffer();
    const png = parsePNG(buffer);
    return png.data;
  },
  getWindow: () => new JSDOM().window,
  getDocument: () => new JSDOM().window._document,
  // @ts-expect-error compatible with @xmldom/xmldom
  getXMLSerializer: () => new XMLSerializer(),
  getDOMParser: () => null,
  setCursor: () => {},
  splitGraphemes: (s: string) => {
    const splitter = new GraphemeSplitter();
    return splitter.splitGraphemes(s);
  },
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    const currTime = new Date().getTime();
    const timeToCall = Math.max(0, 16 - (currTime - lastTime));
    const id = setTimeout(function () {
      callback(currTime + timeToCall);
    }, timeToCall);
    lastTime = currTime + timeToCall;
    return id as unknown as number;
  },
  cancelAnimationFrame: (id: number) => {
    clearTimeout(id);
  },
};
