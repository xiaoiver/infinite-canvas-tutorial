import _gl from 'gl';
import { createCanvas } from 'canvas';
import getPixels from 'get-pixels';
import { JSDOM } from 'jsdom';
import { XMLSerializer, DOMParser } from '@xmldom/xmldom';
import GraphemeSplitter from 'grapheme-splitter';
import parsePNG from 'pngparse-sync';
import { Adapter } from '../packages/core/src/environment';

/** One JSDOM per Jest worker so MouseEvent/CustomEvent share a realm with mocked canvases. */
let testJsdom: JSDOM | null = null;
function getTestJsdom(): JSDOM {
  if (!testJsdom) {
    testJsdom = new JSDOM();
    // ECS tests run in Jest `node` env. Some libs (e.g. @use-gesture/core)
    // access global document/window directly.
    const win = testJsdom.window as any;
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = win;
    }
    if (typeof (globalThis as any).document === 'undefined') {
      (globalThis as any).document = win.document;
    }
    // Keep DOM constructors available for `instanceof` checks in node env.
    if (typeof (globalThis as any).HTMLElement === 'undefined') {
      (globalThis as any).HTMLElement = win.HTMLElement;
    }
    if (typeof (globalThis as any).Element === 'undefined') {
      (globalThis as any).Element = win.Element;
    }
    if (typeof (globalThis as any).EventTarget === 'undefined') {
      (globalThis as any).EventTarget = win.EventTarget;
    }
  }
  return testJsdom;
}

type ListenerEntry = { fn: EventListener; capture: boolean };

function getCaptureFlag(options?: boolean | AddEventListenerOptions): boolean {
  if (typeof options === 'boolean') {
    return options;
  }
  if (options && typeof options === 'object' && options !== null && 'capture' in options) {
    return Boolean((options as AddEventListenerOptions).capture);
  }
  return false;
}

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

  getTestJsdom();

  const listenerMap = new Map<string, ListenerEntry[]>();

  const mockedCanvas: HTMLCanvasElement = {
    width,
    height,
    // @ts-ignore
    getContext: (contextId: string) => {
      let context;
      if (contextId === '2d') {
        context = canvas.getContext('2d');
      } else {
        // @ts-ignore
        gl.canvas = mockedCanvas;
        context = gl;
      }
      context.measureText = (text: string) => {
        return {
          actualBoundingBoxAscent: 18,
          actualBoundingBoxDescent: 18,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: text.length * 18,
          alphabeticBaseline: 18,
          fontBoundingBoxAscent: 18,
          fontBoundingBoxDescent: 18,
          hangingBaseline: 18,
          ideographicBaseline: 18,
          width: text.length * 18,
          emHeightAscent: 18,
          emHeightDescent: 18,
        };
      };
      return context;
    },
    // Local EventTarget: forwarding to `document` made `event.target` the Document and broke
    // @use-gesture (expects the canvas) and did not match listeners registered on this object.
    dispatchEvent: (event: Event) => {
      const entries = [...(listenerMap.get(event.type) ?? [])];
      const captureListeners = entries.filter((e) => e.capture);
      const bubbleListeners = entries.filter((e) => !e.capture);
      Object.defineProperty(event, 'target', {
        value: mockedCanvas,
        configurable: true,
      });
      for (const { fn } of captureListeners) {
        Object.defineProperty(event, 'currentTarget', {
          value: mockedCanvas,
          configurable: true,
        });
        fn.call(mockedCanvas as unknown as EventTarget, event);
      }
      for (const { fn } of bubbleListeners) {
        Object.defineProperty(event, 'currentTarget', {
          value: mockedCanvas,
          configurable: true,
        });
        fn.call(mockedCanvas as unknown as EventTarget, event);
      }
      return !event.defaultPrevented;
    },
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const capture = getCaptureFlag(options);
      const fn: EventListener =
        typeof listener === 'function'
          ? listener
          : (e) => (listener as EventListenerObject).handleEvent(e);
      if (!listenerMap.has(type)) {
        listenerMap.set(type, []);
      }
      listenerMap.get(type)!.push({ fn, capture });
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const capture = getCaptureFlag(options);
      const fn: EventListener =
        typeof listener === 'function'
          ? listener
          : (listener as EventListenerObject).handleEvent.bind(listener);
      const list = listenerMap.get(type);
      if (!list) {
        return;
      }
      const idx = list.findIndex((e) => e.fn === fn && e.capture === capture);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    },
    focus: () => {},
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      toJSON: () => ({}),
    }),
    // @ts-ignore
    toDataURL: (...args) => canvas.toDataURL(...args),
    // @ts-ignore
    toBuffer: (...args) => canvas.toBuffer(...args),
  };

  return mockedCanvas;
}

export function createMouseEvent(type: string, options: any = {}) {
  const window = getTestJsdom().window;
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
  createImage: (_src: string | Blob) =>
    loadImage(__dirname + '/canvas.png') as any,
  getWindow: () => new JSDOM().window,
  getDocument: () => new JSDOM().window._document,
  // @ts-expect-error compatible with @xmldom/xmldom
  getXMLSerializer: () => new XMLSerializer(),
  // @ts-expect-error compatible with @xmldom/xmldom
  getDOMParser: () => new DOMParser(),
  setCursor: () => { },
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
