import _gl from 'gl';
import { createCanvas } from 'canvas';
import { JSDOM } from 'jsdom';
import { XMLSerializer } from '@xmldom/xmldom';
import GraphemeSplitter from 'grapheme-splitter';
import { Adapter } from '../packages/core/src/environment';

export function sleep(n: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, n);
  });
}

export function getCanvas(width = 100, height = 100) {
  let gl = _gl(width, height, {
    antialias: false,
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const canvas = createCanvas(width, height);

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
    addEventListener: () => {},
    removeEventListener: () => {},
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
